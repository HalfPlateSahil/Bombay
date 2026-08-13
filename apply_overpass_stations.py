import json
import difflib
import pprint
import re

with open("overpass_stations.json", "r") as f:
    overpass = json.load(f)

# we can create a list of all overpass station names
overpass_names = list(overpass.keys())

def get_exact_coords(station_name):
    # Some manual overrides for edge cases
    overrides = {
        "csmt": "chhatrapati shivaji maharaj terminus",
        "mumbai central": "mumbai central",
        "bandra": "bandra",
        "ram mandir": "ram mandir",
        "vadala road": "wadala road",
        "gtb nagar": "guru tegh bahadur nagar"
    }
    
    search_name = station_name.lower()
    if search_name in overrides:
        search_name = overrides[search_name]
        
    matches = difflib.get_close_matches(search_name, overpass_names, n=1, cutoff=0.6)
    if matches:
        return overpass[matches[0]]['lat'], overpass[matches[0]]['lon']
    return None, None

from backend.services.gis_service import RAILWAY_NETWORKS

new_networks = []
for net in RAILWAY_NETWORKS:
    for st in net['station_coords']:
        lat, lon = get_exact_coords(st['name'])
        if lat and lon:
            st['lat'] = round(lat, 5)
            st['lon'] = round(lon, 5)
        else:
            print(f"Warning: Could not find exact coords for {st['name']}")
    new_networks.append(net)

with open('backend/services/gis_service.py', 'r') as f:
    content = f.read()

# Replace using string parsing instead of regex
lines = content.split('\n')
gen_idx = 0
for i, line in enumerate(lines):
    if 'def generate_3d_buildings_geojson' in line:
        gen_idx = i
        break

top_part = '\n'.join(lines[:42])
bottom_part = '\n'.join(lines[gen_idx:])

formatted = pprint.pformat(new_networks, sort_dicts=False, width=120)

new_content = top_part + '\n\nRAILWAY_NETWORKS = ' + formatted + '\n\n' + bottom_part

with open('backend/services/gis_service.py', 'w') as f:
    f.write(new_content)

print("Applied exact station coordinates successfully!")
