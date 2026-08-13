import httpx
import json
import math
import pprint

def get_distance(p1, p2):
    return math.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2)

queries = [
    # Western Line
    """[out:json];relation(11511059);out geom;""",
    # Central Line
    """[out:json];relation(11514142);out geom;""",
    # Harbour Line
    """[out:json];relation["route"="train"]["name"="Harbour Line: Mumbai CSMT → Panvel"](18.8, 72.7, 19.5, 73.1);out geom;"""
]

all_lines = {}

for q in queries:
    res = httpx.post("http://overpass-api.de/api/interpreter", data={"data": q}, headers={"User-Agent": "MumbaiAtlas/1.0"}, timeout=60)
    data = res.json()
    
    for element in data.get("elements", []):
        if element["type"] == "relation":
            name = element["tags"].get("name", "")
            if "Western" in name: line_name = "Western Line"
            elif "Central" in name: line_name = "Central Line"
            elif "Harbour" in name: line_name = "Harbour Line"
            else: continue
            
            ways = []
            for member in element.get("members", []):
                if member["type"] == "way" and "geometry" in member:
                    pts = []
                    for pt in member["geometry"]:
                        pts.append((pt["lat"], pt["lon"]))
                    if pts:
                        ways.append(pts)
            all_lines[line_name] = ways

def stitch_ways(ways):
    if not ways: return []
    # Start with the longest way
    ways = sorted(ways, key=len, reverse=True)
    stitched = list(ways.pop(0))
    
    while ways:
        best_way_idx = -1
        best_dist = float('inf')
        best_attach = None # 'start_to_start', 'start_to_end', 'end_to_start', 'end_to_end'
        
        # Look for the way that closest connects to either end of our stitched line
        stitched_start = stitched[0]
        stitched_end = stitched[-1]
        
        for i, w in enumerate(ways):
            w_start = w[0]
            w_end = w[-1]
            
            d1 = get_distance(stitched_end, w_start)
            d2 = get_distance(stitched_end, w_end)
            d3 = get_distance(stitched_start, w_start)
            d4 = get_distance(stitched_start, w_end)
            
            min_d = min(d1, d2, d3, d4)
            if min_d < best_dist:
                best_dist = min_d
                best_way_idx = i
                if min_d == d1: best_attach = 'end_to_start'
                elif min_d == d2: best_attach = 'end_to_end'
                elif min_d == d3: best_attach = 'start_to_start'
                elif min_d == d4: best_attach = 'start_to_end'
                
        # Attach the best way
        best_w = ways.pop(best_way_idx)
        if best_attach == 'end_to_start':
            stitched.extend(best_w)
        elif best_attach == 'end_to_end':
            stitched.extend(reversed(best_w))
        elif best_attach == 'start_to_start':
            stitched = list(reversed(best_w)) + stitched
        elif best_attach == 'start_to_end':
            stitched = list(best_w) + stitched

    # Convert tuples to lists
    return [list(p) for p in stitched]

import sys
sys.path.append('.')
from backend.services.gis_service import RAILWAY_NETWORKS

new_networks = []
for net in RAILWAY_NETWORKS:
    lname = net['line']
    if lname in all_lines:
        stitched = stitch_ways(all_lines[lname])
        
        # Ensure the direction matches the stations (e.g. Western goes South to North or vice versa)
        # We check distance from first station to first/last point of stitched
        st_first = net['station_coords'][0]
        st_last = net['station_coords'][-1]
        
        d_first_to_first = get_distance((st_first['lat'], st_first['lon']), stitched[0])
        d_first_to_last = get_distance((st_first['lat'], st_first['lon']), stitched[-1])
        
        if d_first_to_last < d_first_to_first:
            stitched = list(reversed(stitched))
            
        net['coordinates'] = stitched
        print(f"{lname}: stitched {len(stitched)} points.")
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

print("End-to-end stitching completed!")
