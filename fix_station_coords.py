import pprint

# Load the original stations list from gis_service.py
from backend.services.gis_service import RAILWAY_NETWORKS

fixes = {
    "Grant Road": {"lat": 18.96333, "lon": 72.81579},
    "Mahim": {"lat": 19.04066, "lon": 72.84660},
    "Bandra": {"lat": 19.05507, "lon": 72.84014},
    "Naigaon": {"lat": 19.35109, "lon": 72.84652},
    "Prabhadevi": {"lat": 19.00747, "lon": 72.83590},
    "Lower Parel": {"lat": 18.99568, "lon": 72.83028},
    "Matunga Road": {"lat": 19.02781, "lon": 72.84668}
}

new_networks = []
for net in RAILWAY_NETWORKS:
    for st in net['station_coords']:
        if st['name'] in fixes:
            st['lat'] = fixes[st['name']]['lat']
            st['lon'] = fixes[st['name']]['lon']
    new_networks.append(net)

with open('backend/services/gis_service.py', 'r') as f:
    lines = f.read().split('\n')

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

print("Fixed station coordinates!")
