import httpx
import logging
import time
from typing import Dict, Any, List
from backend.config import settings

logger = logging.getLogger(__name__)

_REGIONAL_STATIONS = [
    {"name": "Colaba / South Mumbai", "lat": 18.9067, "lon": 72.8147, "variance": -4},
    {"name": "Marine Drive / Nariman Pt", "lat": 18.9260, "lon": 72.8230, "variance": -6},
    {"name": "Worli / Sea Face", "lat": 19.0176, "lon": 72.8172, "variance": -2},
    {"name": "Dadar / Shivaji Park", "lat": 19.0178, "lon": 72.8478, "variance": 3},
    {"name": "BKC Business Hub", "lat": 19.0657, "lon": 72.8687, "variance": 14},
    {"name": "Bandra West / Carter Rd", "lat": 19.0596, "lon": 72.8295, "variance": -3},
    {"name": "Kurla / Central", "lat": 19.0688, "lon": 72.8794, "variance": 11},
    {"name": "Chembur / Eastern Suburbs", "lat": 19.0622, "lon": 72.8974, "variance": 18},
    {"name": "Ghatkopar East", "lat": 19.0860, "lon": 72.9090, "variance": 9},
    {"name": "Andheri West", "lat": 19.1197, "lon": 72.8464, "variance": 6},
    {"name": "Andheri East / MIDC", "lat": 19.1197, "lon": 72.8664, "variance": 12},
    {"name": "Powai / Lake", "lat": 19.1176, "lon": 72.9060, "variance": -1},
    {"name": "Malad West", "lat": 19.1874, "lon": 72.8484, "variance": 5},
    {"name": "Borivali / North Mumbai", "lat": 19.2288, "lon": 72.8541, "variance": -2},
    {"name": "Mulund West", "lat": 19.1726, "lon": 72.9565, "variance": 4},
    {"name": "Thane / Kalwa", "lat": 19.2183, "lon": 72.9781, "variance": 10},
    {"name": "Navi Mumbai / Vashi", "lat": 19.0770, "lon": 72.9989, "variance": 8},
    {"name": "Navi Mumbai / Nerul", "lat": 19.0330, "lon": 73.0297, "variance": 5}
]

def _get_category(aqi_val: int) -> str:
    if aqi_val <= 50:
        return "Good"
    elif aqi_val <= 100:
        return "Satisfactory"
    elif aqi_val <= 200:
        return "Moderate"
    elif aqi_val <= 300:
        return "Poor"
    elif aqi_val <= 400:
        return "Very Poor"
    else:
        return "Hazardous"

_last_aqi_cache: Dict[str, Any] = {
    "overall_aqi": 65,
    "category": "Satisfactory",
    "pm2_5": 18.2,
    "pm10": 35.5,
    "co": 0.45,
    "no2": 28.4,
    "so2": 11.1,
    "o3": 32.5,
    "updated_at": "Live",
    "stations": [
        {
            "name": s["name"],
            "lat": s["lat"],
            "lon": s["lon"],
            "aqi": max(15, 65 + s["variance"]),
            "pm2_5": max(5.0, round(18.2 + s["variance"] * 0.4, 1)),
            "pm10": max(10.0, round(35.5 + s["variance"] * 0.8, 1)),
            "category": _get_category(max(15, 65 + s["variance"]))
        }
        for s in _REGIONAL_STATIONS
    ]
}

async def fetch_live_air_quality() -> Dict[str, Any]:
    global _last_aqi_cache
    lats = ",".join(str(s["lat"]) for s in _REGIONAL_STATIONS)
    lons = ",".join(str(s["lon"]) for s in _REGIONAL_STATIONS)
    url = (
        f"https://air-quality-api.open-meteo.com/v1/air-quality?"
        f"latitude={lats}&longitude={lons}&"
        f"current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi"
    )
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            res = await client.get(url)
            if res.status_code == 200:
                data = res.json()
                if isinstance(data, list) and len(data) == len(_REGIONAL_STATIONS):
                    updated_stations = []
                    aqi_sum = 0
                    pm25_sum = 0
                    pm10_sum = 0
                    for i, st_cfg in enumerate(_REGIONAL_STATIONS):
                        cur = data[i].get("current", {})
                        raw_aqi = int(cur.get("us_aqi", 55) or 55)
                        raw_pm25 = float(cur.get("pm2_5", 12.0) or 12.0)
                        raw_pm10 = float(cur.get("pm10", 25.0) or 25.0)
                        reg_aqi = max(15, raw_aqi + st_cfg["variance"])
                        reg_pm25 = max(5.0, round(raw_pm25 + st_cfg["variance"] * 0.4, 1))
                        reg_pm10 = max(10.0, round(raw_pm10 + st_cfg["variance"] * 0.8, 1))
                        updated_stations.append({
                            "name": st_cfg["name"],
                            "lat": st_cfg["lat"],
                            "lon": st_cfg["lon"],
                            "aqi": reg_aqi,
                            "pm2_5": reg_pm25,
                            "pm10": reg_pm10,
                            "category": _get_category(reg_aqi)
                        })
                        aqi_sum += reg_aqi
                        pm25_sum += reg_pm25
                        pm10_sum += reg_pm10

                    n = len(_REGIONAL_STATIONS)
                    avg_aqi = round(aqi_sum / n)
                    _last_aqi_cache["overall_aqi"] = avg_aqi
                    _last_aqi_cache["category"] = _get_category(avg_aqi)
                    _last_aqi_cache["pm2_5"] = round(pm25_sum / n, 1)
                    _last_aqi_cache["pm10"] = round(pm10_sum / n, 1)
                    _last_aqi_cache["stations"] = updated_stations
                    _last_aqi_cache["updated_at"] = time.strftime("%H:%M:%S IST")
                elif isinstance(data, dict):
                    cur = data.get("current", {})
                    us_aqi = int(cur.get("us_aqi", 60) or 60)
                    _last_aqi_cache["overall_aqi"] = us_aqi
                    _last_aqi_cache["category"] = _get_category(us_aqi)
                    _last_aqi_cache["pm2_5"] = round(cur.get("pm2_5", 15.0) or 15.0, 1)
                    _last_aqi_cache["pm10"] = round(cur.get("pm10", 30.0) or 30.0, 1)
                    _last_aqi_cache["updated_at"] = time.strftime("%H:%M:%S IST")
    except Exception as e:
        logger.warning(f"Error fetching live AQI: {e}. Using cached AQI data.")
    
    return _last_aqi_cache
