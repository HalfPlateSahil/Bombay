"""
DEM (Digital Elevation Model) Service
─────────────────────────────────────
Fetches real terrain elevation data from the Open-Meteo Copernicus DEM API
(GLO-90, 90m resolution) and caches results in SQLite for near-instant
repeat lookups.

Used by the disaster engine to produce terrain-following impact zones
instead of generic geometric shapes.
"""

import math
import sqlite3
import logging
import httpx
import asyncio
from typing import List, Tuple, Dict, Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# ── Open-Meteo Elevation API ──────────────────────────────────────────────
ELEVATION_API_URL = "https://api.open-meteo.com/v1/elevation"
MAX_POINTS_PER_REQUEST = 100  # API limit


@dataclass
class ElevationGrid:
    """Structured container for a grid of elevation data points."""
    center_lat: float
    center_lon: float
    radius_km: float
    grid_size: int
    lats: List[float] = field(default_factory=list)
    lons: List[float] = field(default_factory=list)
    elevations: List[float] = field(default_factory=list)  # meters above sea level
    cell_area_sqkm: float = 0.0  # area of each grid cell in km²


def _get_cache_connection() -> sqlite3.Connection:
    """Get a connection to the elevation cache database."""
    conn = sqlite3.connect("mumbai_atlas.db")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS elevation_cache (
            lat_key TEXT NOT NULL,
            lon_key TEXT NOT NULL,
            elevation_m REAL NOT NULL,
            PRIMARY KEY (lat_key, lon_key)
        )
    """)
    conn.commit()
    return conn


def _round_coord(val: float, precision: int = 3) -> str:
    """Round coordinate to cache key precision (3 decimal places ≈ 111m)."""
    return f"{round(val, precision):.{precision}f}"


def _lookup_cached(conn: sqlite3.Connection, points: List[Tuple[float, float]]) -> Dict[Tuple[str, str], float]:
    """Batch lookup cached elevation values."""
    cached = {}
    # SQLite has a limit on query params, so batch in chunks
    for i in range(0, len(points), 500):
        chunk = points[i:i+500]
        placeholders = ",".join([f"(?,?)" for _ in chunk])
        params = []
        for lat, lon in chunk:
            params.extend([_round_coord(lat), _round_coord(lon)])
        
        cursor = conn.execute(
            f"SELECT lat_key, lon_key, elevation_m FROM elevation_cache WHERE (lat_key, lon_key) IN (VALUES {placeholders})",
            params
        )
        for row in cursor:
            cached[(row[0], row[1])] = row[2]
    
    return cached


def _store_cached(conn: sqlite3.Connection, results: List[Tuple[str, str, float]]):
    """Batch insert elevation values into cache."""
    conn.executemany(
        "INSERT OR REPLACE INTO elevation_cache (lat_key, lon_key, elevation_m) VALUES (?, ?, ?)",
        results
    )
    conn.commit()


def generate_grid_points(
    center_lat: float,
    center_lon: float,
    radius_km: float,
    grid_size: int = 20
) -> Tuple[List[float], List[float], float]:
    """
    Generate a grid of lat/lon points covering a circular area.
    
    Returns:
        (lats, lons, cell_area_sqkm)
    """
    # Convert radius from km to degrees
    lat_range_deg = radius_km / 110.574
    lon_range_deg = radius_km / (111.320 * math.cos(math.radians(center_lat)))
    
    lats = []
    lons = []
    
    lat_step = (2 * lat_range_deg) / (grid_size - 1)
    lon_step = (2 * lon_range_deg) / (grid_size - 1)
    
    for i in range(grid_size):
        for j in range(grid_size):
            lat = center_lat - lat_range_deg + (i * lat_step)
            lon = center_lon - lon_range_deg + (j * lon_step)
            
            # Only include points within the circular radius
            dist_km = math.sqrt(
                ((lat - center_lat) * 110.574) ** 2 +
                ((lon - center_lon) * 111.320 * math.cos(math.radians(center_lat))) ** 2
            )
            
            if dist_km <= radius_km:
                lats.append(round(lat, 3))
                lons.append(round(lon, 3))
    
    # Calculate per-cell area
    cell_lat_km = lat_step * 110.574
    cell_lon_km = lon_step * 111.320 * math.cos(math.radians(center_lat))
    cell_area_sqkm = cell_lat_km * cell_lon_km
    
    return lats, lons, cell_area_sqkm


async def _fetch_elevations_from_api(lats: List[float], lons: List[float]) -> List[float]:
    """
    Fetch elevation data from Open-Meteo API in batches of 100.
    Returns list of elevation values in meters.
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        tasks = []
        for i in range(0, len(lats), MAX_POINTS_PER_REQUEST):
            batch_lats = lats[i:i + MAX_POINTS_PER_REQUEST]
            batch_lons = lons[i:i + MAX_POINTS_PER_REQUEST]
            lat_param = ",".join(str(l) for l in batch_lats)
            lon_param = ",".join(str(l) for l in batch_lons)
            tasks.append(client.get(ELEVATION_API_URL, params={"latitude": lat_param, "longitude": lon_param}))
            
        all_elevations = []
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for i, response in enumerate(results):
            batch_size = min(MAX_POINTS_PER_REQUEST, len(lats) - (i * MAX_POINTS_PER_REQUEST))
            if isinstance(response, Exception):
                logger.error(f"[DEM] API fetch failed for batch {i}: {response}")
                all_elevations.extend([-1.0] * batch_size)
            else:
                try:
                    response.raise_for_status()
                    data = response.json()
                    elevs = data.get("elevation", [])
                    if isinstance(elevs, list):
                        all_elevations.extend(elevs)
                    else:
                        all_elevations.append(elevs)
                except Exception as e:
                    logger.error(f"[DEM] API fetch failed for batch {i}: {e}")
                    all_elevations.extend([-1.0] * batch_size)
                    
        logger.info(f"[DEM] Fetched {len(all_elevations)} elevation points from Open-Meteo concurrently")
    
    return all_elevations


async def fetch_elevation_grid(
    center_lat: float,
    center_lon: float,
    radius_km: float = 45.0,
    grid_size: int = 20
) -> ElevationGrid:
    """
    Fetch a grid of real elevation data around a center point.
    
    Uses cache-first strategy:
    1. Generate grid points
    2. Check SQLite cache for existing data
    3. Fetch only missing points from Open-Meteo API
    4. Cache new results
    5. Return complete ElevationGrid
    
    Args:
        center_lat: Epicenter latitude
        center_lon: Epicenter longitude
        radius_km: Radius of the grid in km (default 45km for cyclone coverage)
        grid_size: Number of points per axis (default 20, giving ~314 points in circle)
    
    Returns:
        ElevationGrid with all elevation data
    """
    # 1. Generate grid points
    lats, lons, cell_area = generate_grid_points(center_lat, center_lon, radius_km, grid_size)
    
    logger.info(f"[DEM] Grid generated: {len(lats)} points, radius={radius_km}km, cell_area={cell_area:.4f}km²")
    
    # 2. Check cache
    conn = _get_cache_connection()
    points = list(zip(lats, lons))
    cached = _lookup_cached(conn, points)
    
    # 3. Identify uncached points
    uncached_indices = []
    uncached_lats = []
    uncached_lons = []
    
    for idx, (lat, lon) in enumerate(points):
        key = (_round_coord(lat), _round_coord(lon))
        if key not in cached:
            uncached_indices.append(idx)
            uncached_lats.append(lat)
            uncached_lons.append(lon)
    
    logger.info(f"[DEM] Cache: {len(cached)} hits, {len(uncached_indices)} misses")
    
    # 4. Fetch uncached from API
    if uncached_lats:
        new_elevations = await _fetch_elevations_from_api(uncached_lats, uncached_lons)
        

        # Store in cache
        cache_entries = []
        for idx, elev in zip(uncached_indices, new_elevations):
            lat_key = _round_coord(lats[idx])
            lon_key = _round_coord(lons[idx])
            cached[(lat_key, lon_key)] = elev
            cache_entries.append((lat_key, lon_key, elev))
        
        _store_cached(conn, cache_entries)
        logger.info(f"[DEM] Cached {len(cache_entries)} new elevation points")
    
    conn.close()
    
    # 5. Build result
    elevations = []
    for lat, lon in points:
        key = (_round_coord(lat), _round_coord(lon))
        elev = cached.get(key, 0.0)
        # Clamp negative elevations (below sea level / ocean) to 0
        elevations.append(max(0.0, elev) if elev != -1.0 else 0.0)
    
    grid = ElevationGrid(
        center_lat=center_lat,
        center_lon=center_lon,
        radius_km=radius_km,
        grid_size=grid_size,
        lats=lats,
        lons=lons,
        elevations=elevations,
        cell_area_sqkm=cell_area
    )
    
    logger.info(f"[DEM] Grid complete: {len(elevations)} points, "
                f"min_elev={min(elevations):.1f}m, max_elev={max(elevations):.1f}m")
    
    return grid


def fetch_elevation_grid_sync(
    center_lat: float,
    center_lon: float,
    radius_km: float = 45.0,
    grid_size: int = 20
) -> ElevationGrid:
    """Synchronous wrapper for fetch_elevation_grid (for use in non-async contexts)."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # We're inside an async context — create a new thread
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(
                    asyncio.run,
                    fetch_elevation_grid(center_lat, center_lon, radius_km, grid_size)
                )
                return future.result(timeout=30)
        else:
            return loop.run_until_complete(
                fetch_elevation_grid(center_lat, center_lon, radius_km, grid_size)
            )
    except RuntimeError:
        return asyncio.run(
            fetch_elevation_grid(center_lat, center_lon, radius_km, grid_size)
        )
