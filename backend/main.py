import logging
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Query, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from contextlib import asynccontextmanager

from backend.config import settings
from backend.database.db import engine, Base, get_db
from backend.services.weather_service import fetch_live_weather
from backend.services.air_quality_service import fetch_live_air_quality
from backend.services.marine_service import fetch_live_marine
from backend.services.traffic_service import fetch_live_traffic
from backend.services.gis_service import get_mumbai_gis_data, generate_3d_buildings_geojson, RAILWAY_NETWORKS
from backend.services.train_service import generate_live_trains_geojson
from backend.services.yatri_service import get_yatri_diagnostics
from backend.services.flight_service import fetch_live_flights, get_flight_photo
from backend.services.disaster_engine import (
    run_flood_simulation,
    run_cyclone_simulation,
    run_earthquake_simulation,
    run_fire_simulation,
    run_sea_level_rise_simulation
)
from backend.services.floodmap_service import process_flood_tile
from fastapi.responses import Response
from backend.websocket.manager import ws_manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create database tables
Base.metadata.create_all(bind=engine)



app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "app": settings.APP_NAME,
        "location": "Mumbai, India (19.0760° N, 72.8777° E)",
        "docs": "/docs"
    }

@app.get(f"{settings.API_PREFIX}/weather")
async def get_weather():
    return await fetch_live_weather()

@app.get(f"{settings.API_PREFIX}/air-quality")
async def get_air_quality():
    return await fetch_live_air_quality()

@app.get(f"{settings.API_PREFIX}/marine")
async def get_marine():
    return await fetch_live_marine()

@app.get(f"{settings.API_PREFIX}/traffic")
async def get_traffic():
    return await fetch_live_traffic()

@app.get(f"{settings.API_PREFIX}/trains/live")
async def get_trains(sim_time: str = None, yatri: bool = True):
    return await generate_live_trains_geojson(sim_time, yatri_enabled=yatri)

@app.get(f"{settings.API_PREFIX}/trains/yatri-status")
async def get_yatri_status():
    return get_yatri_diagnostics()

@app.get(f"{settings.API_PREFIX}/flights/live")
async def get_flights():
    return await fetch_live_flights()

@app.get("/api/v1/flights/photo/{icao24}")
async def get_flight_photo_route(icao24: str):
    url = await get_flight_photo(icao24)
    if url:
        return RedirectResponse(url)
    # Return a 404 or a placeholder if no photo
    return {"error": "No photo found"}

@app.get(f"{settings.API_PREFIX}/gis/mumbai")
def get_gis():
    return get_mumbai_gis_data()

@app.get(f"{settings.API_PREFIX}/floodmap/{{z}}/{{x}}/{{y}}")
async def get_floodmap_tile(z: int, x: int, y: int, elev: float = Query(0.0)):
    try:
        img_bytes = await process_flood_tile(z, x, y, elev)
        return Response(content=img_bytes, media_type="image/png")
    except Exception as e:
        logger.error(f"Error generating flood tile: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post(f"{settings.API_PREFIX}/simulation/run")
def run_simulation(payload: dict):
    disaster_type = payload.get("disaster_type", "flood")
    lat = float(payload.get("lat", 19.0125))  # Default Hindmata / Dadar
    lon = float(payload.get("lon", 72.8445))
    
    if disaster_type == "flood":
        rain = float(payload.get("rainfall_mm_hr", 120.0))
        tide = float(payload.get("tide_height_m", 4.2))
        surge = float(payload.get("surge_m", 0.8))
        res = run_flood_simulation(lat, lon, rain, tide, surge)
    elif disaster_type == "cyclone":
        wind = float(payload.get("wind_speed_kmh", 165.0))
        pressure = float(payload.get("central_pressure_mb", 955.0))
        res = run_cyclone_simulation(lat, lon, wind, pressure)
    elif disaster_type == "earthquake":
        mag = float(payload.get("magnitude", 6.8))
        depth = float(payload.get("depth_km", 10.0))
        res = run_earthquake_simulation(lat, lon, mag, depth)
    elif disaster_type == "fire":
        radius = float(payload.get("fire_radius_m", 450.0))
        wind = float(payload.get("wind_speed_kmh", 25.0))
        wind_dir = float(payload.get("wind_direction_deg", 240.0))
        res = run_fire_simulation(lat, lon, radius, wind, wind_dir)
    elif disaster_type == "climate":
        rise = float(payload.get("sea_level_rise_m", 2.0))
        res = run_sea_level_rise_simulation(rise)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown disaster type: {disaster_type}")
        
    return {
        "status": "success",
        "epicenter": {"lat": lat, "lon": lon},
        "simulation": res
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo or process client messages
            await websocket.send_json({"event": "ack", "received": data})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
