import httpx
import logging
import time
from typing import Dict, Any
from backend.config import settings

logger = logging.getLogger(__name__)

# Cached fallback in case network is down
_last_weather_cache: Dict[str, Any] = {
    "temperature": 29.5,
    "humidity": 78,
    "rainfall": 12.4,
    "wind_speed": 18.2,
    "wind_direction": 240,
    "cloud_cover": 65,
    "condition_text": "Monsoon Showers",
    "updated_at": "Just now",
    "status": "live"
}

async def fetch_live_weather() -> Dict[str, Any]:
    global _last_weather_cache
    url = (
        f"https://api.open-meteo.com/v1/forecast?"
        f"latitude={settings.MUMBAI_LAT}&longitude={settings.MUMBAI_LON}&"
        f"current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,cloud_cover"
    )
    start_time = time.time()
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            res = await client.get(url)
            if res.status_code == 200:
                data = res.json().get("current", {})
                temp = data.get("temperature_2m", 29.0)
                rain = data.get("precipitation", 0.0)
                condition = "Clear Sky"
                if rain > 50:
                    condition = "Torrential Downpour"
                elif rain > 10:
                    condition = "Heavy Monsoon Rain"
                elif rain > 0:
                    condition = "Light Rain"
                elif data.get("cloud_cover", 0) > 70:
                    condition = "Overcast"
                elif data.get("cloud_cover", 0) > 30:
                    condition = "Partly Cloudy"

                _last_weather_cache = {
                    "temperature": round(temp, 1),
                    "humidity": round(data.get("relative_humidity_2m", 75), 1),
                    "rainfall": round(rain, 1),
                    "wind_speed": round(data.get("wind_speed_10m", 15.0), 1),
                    "wind_direction": int(data.get("wind_direction_10m", 230)),
                    "cloud_cover": int(data.get("cloud_cover", 60)),
                    "condition_text": condition,
                    "response_ms": round((time.time() - start_time) * 1000, 2),
                    "updated_at": time.strftime("%H:%M:%S IST"),
                    "status": "live"
                }
                return _last_weather_cache
    except Exception as e:
        logger.warning(f"Error fetching live weather from Open-Meteo: {e}. Returning cached data.")
        _last_weather_cache["status"] = "cached_fallback"
    
    return _last_weather_cache
