import json
import pprint

with open("relation_geometries.json", "r") as f:
    rels = json.load(f)
with open("harbour_geometries.json", "r") as f:
    harbours = json.load(f)

# The coordinates we want to use:
western_coords = rels["Western Line (Slow): Virar => Churchgate"]
# Western Line stations go from Churchgate to Virar, so the line is backwards.
# We reverse it so Churchgate is near index 0.
western_coords = western_coords[::-1]

# Central Line goes CSMT to Thane. "Mumbai CSMT → Kasara (Fast)" goes North.
central_coords = rels["Central Line: Mumbai CSMT → Kasara (Fast)"]

# Harbour Line goes CSMT to Panvel
harbour_coords = harbours["Harbour Line: Mumbai CSMT → Panvel"]

from backend.services.gis_service import RAILWAY_NETWORKS

new_networks = []
for net in RAILWAY_NETWORKS:
    line_name = net['line']
    if line_name == "Western Line":
        net['coordinates'] = western_coords
    elif line_name == "Central Line":
        net['coordinates'] = central_coords
    elif line_name == "Harbour Line":
        net['coordinates'] = harbour_coords
    new_networks.append(net)

# Rewrite gis_service.py
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

print("Injected high-res geometries into gis_service.py!")
