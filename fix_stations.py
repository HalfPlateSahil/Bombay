import sys
import math
sys.path.append('.')
from backend.services.gis_service import RAILWAY_NETWORKS

wl = None
for r in RAILWAY_NETWORKS:
    if r['line'] == 'Western Line':
        wl = r['coordinates']
        break

def get_closest(target_lat, target_lon):
    min_dist = float('inf')
    best_coord = None
    for coord in wl:
        # roughly pythagorean on degrees
        dist = (coord[0] - target_lat)**2 + (coord[1] - target_lon)**2
        if dist < min_dist:
            min_dist = dist
            best_coord = coord
    return best_coord

print("Dadar:", get_closest(19.0181, 72.8427))
print("Santacruz:", get_closest(19.0827, 72.8415))
print("Jogeshwari:", get_closest(19.1362, 72.8492))
