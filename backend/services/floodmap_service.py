import io
import httpx
import logging
import numpy as np
from PIL import Image
from typing import Dict, Tuple

logger = logging.getLogger(__name__)

MAPBOX_TOKEN = "pk.eyJ1IjoiaGFsZnBsYXRlc2FoaWwiLCJhIjoiY21zdGY5ZXI5MGlmcDJ5cnlvM20zNnlxaCJ9.hIFOeLt9Vg_YerMUf68QZA"

limits = httpx.Limits(max_keepalive_connections=50, max_connections=100)
http_client = httpx.AsyncClient(limits=limits, timeout=12.0)

# In-memory LRU-style cache for Mapbox DEM elevation arrays: (z, x, y) -> np.ndarray
_dem_cache: Dict[Tuple[int, int, int], np.ndarray] = {}

# Empty transparent 512x512 tile
_blank_tile: bytes = b""
def _get_blank_tile() -> bytes:
    global _blank_tile
    if not _blank_tile:
        blank = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
        buf = io.BytesIO()
        blank.save(buf, format="PNG")
        _blank_tile = buf.getvalue()
    return _blank_tile

async def _get_terrain_dem(z: int, x: int, y: int) -> np.ndarray:
    key = (z, x, y)
    if key in _dem_cache:
        return _dem_cache[key]
        
    terrain_url = f"https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1/{z}/{x}/{y}.pngraw?access_token={MAPBOX_TOKEN}"
    try:
        response = await http_client.get(terrain_url)
        if response.status_code == 200:
            img = Image.open(io.BytesIO(response.content)).convert("RGB")
            arr = np.array(img, dtype=np.float32)
            r = arr[:, :, 0]
            g = arr[:, :, 1]
            b = arr[:, :, 2]
            
            # Mapbox Terrain-RGB decode: height = -10000 + ((R * 256 * 256 + G * 256 + B) * 0.1)
            height = -10000.0 + ((r * 65536.0 + g * 256.0 + b) * 0.1)
            
            # Cap cache size to 250 tiles (~250MB) to protect memory
            if len(_dem_cache) > 250:
                # Remove oldest 50 items
                for old_k in list(_dem_cache.keys())[:50]:
                    _dem_cache.pop(old_k, None)
                    
            _dem_cache[key] = height
            return height
        else:
            logger.warning(f"Mapbox terrain DEM returned status {response.status_code} for {z}/{x}/{y}")
    except Exception as e:
        logger.warning(f"Error fetching Mapbox terrain DEM for {z}/{x}/{y}: {e}")
        
    return None

async def process_flood_tile(z: int, x: int, y: int, elev: float) -> bytes:
    """
    Computes a hydrodynamic flood inundation overlay from elevation data.
    Submerges land where elevation <= elev with realistic water depth color grading.
    """
    height = await _get_terrain_dem(z, x, y)
    if height is None:
        return _get_blank_tile()
        
    try:
        # Land inundation mask (exclude deep void and open ocean < -0.5m)
        # Land submerged when 0.05 < height <= elev
        land_submerged = (height > 0.05) & (height <= elev)
        
        # Coastal surge interface: -0.5 < height <= 0.05
        coastal_surge = (height > -0.5) & (height <= 0.05) & (elev > 1.5)
        
        # If no flooded pixels, return blank tile fast
        if not np.any(land_submerged) and not np.any(coastal_surge):
            return _get_blank_tile()
            
        out_arr = np.zeros((height.shape[0], height.shape[1], 4), dtype=np.uint8)
        
        # Water depth on land: depth = elev - height
        depth = np.clip(elev - height, 0.0, 15.0)
        
        # 1. Shallow water (0.05m to 1.0m): Radiant turquoise / cyan
        shallow = land_submerged & (depth <= 1.0)
        out_arr[shallow] = [34, 211, 238, 190] # #22d3ee
        
        # 2. Moderate water (1.0m to 3.0m): Deep electric blue
        moderate = land_submerged & (depth > 1.0) & (depth <= 3.0)
        out_arr[moderate] = [14, 165, 233, 225] # #0ea5e9
        
        # 3. Critical flood depth (> 3.0m): Severe ocean navy blue
        deep = land_submerged & (depth > 3.0)
        out_arr[deep] = [2, 132, 199, 245] # #0284c7
        
        # 4. Coastal surge wave line
        out_arr[coastal_surge] = [56, 189, 248, 140] # #38bdf8
        
        out_img = Image.fromarray(out_arr, "RGBA")
        buf = io.BytesIO()
        out_img.save(buf, format="PNG", optimize=False)
        return buf.getvalue()
    except Exception as e:
        logger.error(f"Error processing flood tile {z}/{x}/{y} at elev {elev}: {e}")
        return _get_blank_tile()
