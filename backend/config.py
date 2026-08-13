import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "Mumbai Atlas Digital Twin & Disaster Engine"
    API_PREFIX: str = "/api/v1"
    DEBUG: bool = True
    
    # Coordinates for Mumbai Central
    MUMBAI_LAT: float = 19.0760
    MUMBAI_LON: float = 72.8777
    
    # API Keys (Optional with high-fidelity fallbacks)
    TOMTOM_API_KEY: str = os.getenv("TOMTOM_API_KEY", "")
    CESIUM_ION_TOKEN: str = os.getenv("CESIUM_ION_TOKEN", "")
    
    # Refresh Intervals (seconds)
    TRAFFIC_REFRESH_SECONDS: int = 120    # 2 minutes
    WEATHER_REFRESH_SECONDS: int = 300    # 5 minutes
    AQI_REFRESH_SECONDS: int = 600        # 10 minutes
    MARINE_REFRESH_SECONDS: int = 600     # 10 minutes
    
    # Yatri Railways Live GPS API
    YATRI_API_KEY: str = "66e1dtq14tYjVplpOrdaXq681fsh1rJylRaLIC1v1jg="
    YATRI_API_BASE_URL: str = "https://api.yatrirailways.com/api/v1"
    YATRI_ENABLED: bool = True
    YATRI_CACHE_TTL_SECONDS: int = 5        # GPS updates frequently, keep cache fresh
    YATRI_SAFETY_WINDOW_BEFORE: int = 30    # Minutes before scheduled departure to start querying
    YATRI_SAFETY_WINDOW_AFTER: int = 30     # Minutes after scheduled arrival to keep querying
    YATRI_BATCH_SIZE: int = 20              # Max train numbers per API request
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./mumbai_atlas.db")

settings = Settings()
