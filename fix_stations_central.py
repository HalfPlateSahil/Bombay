import sys
sys.path.append('.')
from backend.services.gis_service import RAILWAY_NETWORKS

cl = None
for r in RAILWAY_NETWORKS:
    if r['line'] == 'Central Line':
        cl = r['coordinates']
        break

def get_closest(target_lat, target_lon):
    min_dist = float('inf')
    best_coord = None
    for coord in cl:
        dist = (coord[0] - target_lat)**2 + (coord[1] - target_lon)**2
        if dist < min_dist:
            min_dist = dist
            best_coord = coord
    return best_coord

print("Central Dadar:", get_closest(19.0181, 72.8427))
