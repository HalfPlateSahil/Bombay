import httpx
import logging
import time
import random
from typing import Dict, Any, List
from backend.config import settings

logger = logging.getLogger(__name__)

# Key Mumbai Corridors & Arterial Highways
MUMBAI_ROADS = [
    {"id": "weh", "name": "Western Express Highway (Dahisar to Bandra)", "base_speed": 65, "coordinates": [[19.25, 72.86], [19.15, 72.85], [19.06, 72.84]]},
    {"id": "eeh", "name": "Eastern Express Highway (Thane to Sion)", "base_speed": 60, "coordinates": [[19.21, 72.96], [19.12, 72.92], [19.04, 72.86]]},
    {"id": "bwsl", "name": "Bandra-Worli Sea Link & Coastal Road", "base_speed": 80, "coordinates": [[19.04, 72.81], [19.00, 72.81], [18.95, 72.80]]},
    {"id": "sv_road", "name": "Swami Vivekanand (SV) Road", "base_speed": 40, "coordinates": [[19.20, 72.84], [19.12, 72.83], [19.05, 72.83]]},
    {"id": "lbs_marg", "name": "Lal Bahadur Shastri (LBS) Marg", "base_speed": 35, "coordinates": [[19.19, 72.94], [19.10, 72.90], [19.07, 72.88]]},
    {"id": "sclink", "name": "Santa Cruz-Chembur Link Road (SCLR)", "base_speed": 50, "coordinates": [[19.07, 72.86], [19.07, 72.89]]},
    {"id": "dharavi_rd", "name": "90 Feet Road (Dharavi / Sion)", "base_speed": 30, "coordinates": [[19.04, 72.85], [19.04, 72.86]]},
    {"id": "marine_drive", "name": "Marine Drive (Netaji Subhash Chandra Bose Road)", "base_speed": 55, "coordinates": [[18.95, 72.82], [18.93, 72.82]]}
]

async def fetch_live_traffic() -> Dict[str, Any]:
    roads_status: List[Dict[str, Any]] = []
    total_congestion = 0.0
    
    # Calculate time-of-day rush hour factor for Mumbai IST time
    current_hour = (time.gmtime().tm_hour + 5.5) % 24
    rush_factor = 1.0
    if 8.5 <= current_hour <= 11.5 or 17.5 <= current_hour <= 20.5:
        rush_factor = 1.6  # Peak Mumbai Rush Hour
    elif 1.0 <= current_hour <= 5.0:
        rush_factor = 0.4  # Late Night Free Flow
        
    for r in MUMBAI_ROADS:
        # Simulate realistic micro-variations
        congestion_index = min(98.0, max(10.0, random.normalvariate(45 * rush_factor, 12)))
        curr_speed = max(8.0, r["base_speed"] * (1.0 - (congestion_index / 120.0)))
        
        status = "Free Flow"
        if congestion_index > 75:
            status = "Heavy Traffic / Blocked"
        elif congestion_index > 50:
            status = "Moderate Slowdown"
            
        total_congestion += congestion_index
        roads_status.append({
            "id": r["id"],
            "name": r["name"],
            "congestion": round(congestion_index, 1),
            "current_speed_kmh": round(curr_speed, 1),
            "free_flow_speed_kmh": r["base_speed"],
            "status": status,
            "coordinates": r["coordinates"]
        })
        
    avg_congestion = round(total_congestion / len(MUMBAI_ROADS), 1)
    
    return {
        "city_overall_congestion": avg_congestion,
        "traffic_index_level": "Severe Rush" if avg_congestion > 70 else ("Moderate" if avg_congestion > 40 else "Light"),
        "roads": roads_status,
        "updated_at": time.strftime("%H:%M:%S IST")
    }
