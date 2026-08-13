from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, Text
from datetime import datetime
from backend.database.db import Base

class WeatherRecord(Base):
    __tablename__ = "weather"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    temperature = Column(Float)       # Celsius
    humidity = Column(Float)          # %
    rainfall = Column(Float)          # mm/hr
    wind_speed = Column(Float)        # km/h
    wind_direction = Column(Float)    # degrees
    cloud_cover = Column(Float)       # %
    condition_text = Column(String)

class AQIRecord(Base):
    __tablename__ = "air_quality"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    station_name = Column(String)
    aqi = Column(Integer)
    pm2_5 = Column(Float)
    pm10 = Column(Float)
    co = Column(Float)
    no2 = Column(Float)
    so2 = Column(Float)
    o3 = Column(Float)
    category = Column(String)  # Good, Moderate, Poor, Severe, Hazardous

class MarineRecord(Base):
    __tablename__ = "marine"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    tide_height = Column(Float)        # meters
    tide_status = Column(String)       # High Tide / Low Tide
    wave_height = Column(Float)        # meters
    sea_surface_temp = Column(Float)   # Celsius

class TrafficRecord(Base):
    __tablename__ = "traffic"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    road_id = Column(String)
    road_name = Column(String)
    congestion_score = Column(Float)   # 0 to 100
    average_speed = Column(Float)      # km/h
    status = Column(String)            # Free Flow, Moderate, Heavy, Blocked

class SimulationRecord(Base):
    __tablename__ = "simulations"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    disaster_type = Column(String)     # flood, cyclone, earthquake, fire, climate
    epicenter_lat = Column(Float)
    epicenter_lon = Column(Float)
    location_name = Column(String)
    parameters = Column(JSON)
    results = Column(JSON)

class APILog(Base):
    __tablename__ = "api_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    service_name = Column(String)
    status_code = Column(Integer)
    response_time_ms = Column(Float)
    error_message = Column(Text, nullable=True)
