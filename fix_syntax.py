import sys

with open('backend/services/gis_service.py', 'r') as f:
    lines = f.readlines()

# find def generate_3d_buildings_geojson()
gen_idx = 0
for i, line in enumerate(lines):
    if 'def generate_3d_buildings_geojson' in line:
        gen_idx = i
        break

# The correct RAILWAY_NETWORKS list from before, with snapped stations
from fix_stations import new_networks
import pprint

top_part = lines[:42]
bottom_part = lines[gen_idx:]

with open('backend/services/gis_service.py', 'w') as f:
    for line in top_part:
        f.write(line)
        
    f.write('RAILWAY_NETWORKS = ' + pprint.pformat(new_networks, sort_dicts=False, width=120) + '\n\n')
    
    for line in bottom_part:
        f.write(line)

print("Syntax fixed!")
