import httpx
import logging
import time
from typing import Dict, Any

logger = logging.getLogger(__name__)

# Bounding box for Mumbai
LAMIN = 18.8
LOMIN = 72.7
LAMAX = 19.3
LOMAX = 73.0

_last_flights_cache: Dict[str, Any] = {
    "type": "FeatureCollection",
    "features": []
}

async def fetch_live_flights() -> Dict[str, Any]:
    global _last_flights_cache
    url = f"https://opensky-network.org/api/states/all?lamin={LAMIN}&lomin={LOMIN}&lamax={LAMAX}&lomax={LOMAX}"
    
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            # We add a fake user-agent as OpenSky sometimes blocks default python user-agents
            headers = {"User-Agent": "MumbaiAtlas/1.0 (Student Project)"}
            res = await client.get(url, headers=headers)
            
            if res.status_code == 200:
                data = res.json()
                states = data.get("states")
                
                features = []
                if states:
                    for s in states:
                        # s indices: 
                        # 0: icao24, 1: callsign, 2: origin_country, 5: lon, 6: lat
                        # 7: baro_altitude, 8: on_ground, 9: velocity, 10: true_track
                        lon = s[5]
                        lat = s[6]
                        if lon is None or lat is None:
                            continue
                            
                        callsign = str(s[1]).strip() if s[1] else "Unknown"
                        country = s[2] or "Unknown"
                        altitude = s[7] or 0
                        velocity = s[9] or 0
                        heading = s[10] or 0
                        
                        features.append({
                            "type": "Feature",
                            "geometry": {
                                "type": "Point",
                                "coordinates": [lon, lat]
                            },
                            "properties": {
                                "id": s[0],
                                "callsign": callsign,
                                "country": country,
                                "altitude_m": altitude,
                                "velocity_ms": velocity,
                                "heading": heading
                            }
                        })
                        
                _last_flights_cache = {
                    "type": "FeatureCollection",
                    "features": features
                }
                return _last_flights_cache
            elif res.status_code == 429:
                logger.warning("OpenSky API rate limit exceeded. Returning cached flights.")
            else:
                logger.warning(f"OpenSky API error {res.status_code}. Returning cached flights.")
                
    except Exception as e:
        logger.warning(f"Error fetching live flights: {e}. Returning cached data.")
        
    return _last_flights_cache

# Cache for airplane photos: icao24 -> thumbnail_url
_photo_cache: Dict[str, str] = {}

async def get_flight_photo(icao24: str) -> str:
    if icao24 in _photo_cache:
        return _photo_cache[icao24]
        
    url = f"https://api.planespotters.net/pub/photos/hex/{icao24}"
    headers = {"User-Agent": "MumbaiAtlas/1.0 (+https://mumbai-atlas.com)"}
    
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(url, headers=headers)
            if res.status_code == 200:
                data = res.json()
                photos = data.get("photos", [])
                if photos:
                    photo_url = photos[0].get("thumbnail_large", {}).get("src", "")
                    _photo_cache[icao24] = photo_url
                    return photo_url
    except Exception as e:
        logger.warning(f"Error fetching photo for {icao24}: {e}")
        
    _photo_cache[icao24] = ""
    return ""
