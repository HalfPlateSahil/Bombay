import sys
import os

sys.path.append('.')
from backend.services.gis_service import RAILWAY_NETWORKS

# Cache track distances and indices
_TRACK_CACHE = {}

def build_track_cache():
    global _TRACK_CACHE
    import math
    for network in RAILWAY_NETWORKS:
        line_name = network["line"]
        coords = network["coordinates"]
        
        cum_dist = [0.0]
        total = 0.0
        for i in range(1, len(coords)):
            p1 = coords[i-1]
            p2 = coords[i]
            lat1, lon1, lat2, lon2 = map(math.radians, [p1[0], p1[1], p2[0], p2[1]])
            dlon = lon2 - lon1
            dlat = lat2 - lat1
            a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
            c = 2 * math.asin(math.sqrt(a))
            dist = c * 6371000.0
            total += dist
            cum_dist.append(total)
            
        _TRACK_CACHE[line_name] = {
            "coords": coords,
            "cum_dist": cum_dist,
            "total_dist": total
        }

def find_closest_index(lat: float, lon: float, line_name: str) -> int:
    track = _TRACK_CACHE.get(line_name)
    if not track: return 0
    
    best_dist = float('inf')
    best_idx = 0
    for i, p in enumerate(track["coords"]):
        d = (p[0] - lat)**2 + (p[1] - lon)**2
        if d < best_dist:
            best_dist = d
            best_idx = i
    return best_idx

build_track_cache()

for net in RAILWAY_NETWORKS:
    if net["line"] == "Western Line":
        print(f"Western Line - {len(net['coordinates'])} track points")
        for st in net["station_coords"]:
            idx = find_closest_index(st["lat"], st["lon"], "Western Line")
            print(f"{st['name']}: index {idx} / dist {_TRACK_CACHE['Western Line']['cum_dist'][idx]:.1f}")
