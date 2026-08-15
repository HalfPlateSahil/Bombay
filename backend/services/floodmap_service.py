import io
import httpx
import numpy as np
from PIL import Image

MAPBOX_TOKEN = "pk.eyJ1IjoiaGFsZnBsYXRlc2FoaWwiLCJhIjoiY21zdGY5ZXI5MGlmcDJ5cnlvM20zNnlxaCJ9.hIFOeLt9Vg_YerMUf68QZA"

# Use a global client with a connection pool and limits to prevent TCP exhaustion and 500 errors under heavy tile load
limits = httpx.Limits(max_keepalive_connections=50, max_connections=100)
http_client = httpx.AsyncClient(limits=limits, timeout=15.0)

async def process_flood_tile(z: int, x: int, y: int, elev: float) -> bytes:
    terrain_url = f"https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1/{z}/{x}/{y}.pngraw?access_token={MAPBOX_TOKEN}"
    
    try:
        response = await http_client.get(terrain_url)
        if response.status_code != 200:
            raise ValueError(f"Mapbox returned {response.status_code}")
    except Exception as e:
        with open("floodmap_error.log", "a") as f:
            f.write(f"Fetch Error: {str(e)}\n")
        # Return an empty 512x512 transparent PNG instead of breaking the map
        blank = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
        buf = io.BytesIO()
        blank.save(buf, format="PNG")
        return buf.getvalue()
        
    try:
        img = Image.open(io.BytesIO(response.content)).convert("RGB")
        arr = np.array(img, dtype=np.float32)
        
        r = arr[:, :, 0]
        g = arr[:, :, 1]
        b = arr[:, :, 2]
        
        # Mapbox Terrain-RGB formula
        height = -10000.0 + ((r * 256.0 * 256.0 + g * 256.0 + b) * 0.1)
        
        # Create mask where height <= elev and not void (-10000)
        mask = (height <= elev) & (height > -9999.0)
        
        # Create output RGBA image
        out_arr = np.zeros((img.height, img.width, 4), dtype=np.uint8)
        
        # Floodmap water: Darker, realistic blue RGB(31, 97, 141), Alpha 255
        out_arr[mask] = [31, 97, 141, 255]
        
        out_img = Image.fromarray(out_arr, "RGBA")
        
        buf = io.BytesIO()
        out_img.save(buf, format="PNG", optimize=True)
        return buf.getvalue()
    except Exception as e:
        with open("floodmap_error.log", "a") as f:
            import traceback
            f.write(f"Processing Error: {str(e)}\n{traceback.format_exc()}\n")
        raise ValueError(f"Processing failed: {str(e)}")
