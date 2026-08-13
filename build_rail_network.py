import httpx
import json
import networkx as nx
import math
import pprint
import sys
import urllib.parse

def get_distance(p1, p2):
    return math.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2)

query = """
[out:json];
(
  way["railway"="rail"](18.8, 72.7, 19.5, 73.1);
  way["railway"="subway"](18.8, 72.7, 19.5, 73.1);
);
out geom;
"""

print("Fetching railway geometries from Overpass...")
try:
    url = "https://overpass-api.de/api/interpreter?data=" + urllib.parse.quote(query)
    res = httpx.get(
        url, 
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
        timeout=60.0
    )
    if res.status_code != 200:
        print(f"Error {res.status_code}: {res.text}")
        sys.exit(1)
        
    data = res.json()
except Exception as e:
    print(f"Exception: {e}")
    if 'res' in locals():
        print(f"Response text: {res.text[:500]}")
    sys.exit(1)

G = nx.Graph()

for element in data["elements"]:
    if element["type"] == "way" and "geometry" in element:
        geom = element["geometry"]
        for i in range(len(geom)-1):
            p1 = (geom[i]["lat"], geom[i]["lon"])
            p2 = (geom[i+1]["lat"], geom[i+1]["lon"])
            dist = get_distance(p1, p2)
            G.add_edge(p1, p2, weight=dist)

print(f"Built rail graph with {G.number_of_nodes()} nodes and {G.number_of_edges()} edges.")

def closest_node(lat, lon):
    min_dist = float('inf')
    best_node = None
    for node in G.nodes():
        d = get_distance((lat, lon), node)
        if d < min_dist:
            min_dist = d
            best_node = node
    return best_node

sys.path.append('.')
from backend.services.gis_service import RAILWAY_NETWORKS

new_networks = []
for net in RAILWAY_NETWORKS:
    stations = net['station_coords']
    new_coords = []
    
    for i in range(len(stations)):
        st = stations[i]
        n1 = closest_node(st['lat'], st['lon'])
        
        if i == 0:
            new_coords.append(list(n1))
        
        if i < len(stations) - 1:
            st2 = stations[i+1]
            n2 = closest_node(st2['lat'], st2['lon'])
            
            try:
                path = nx.shortest_path(G, n1, n2, weight='weight')
                for p in path[1:]:
                    new_coords.append(list(p))
            except nx.NetworkXNoPath:
                print(f"Warning: No path between {st['name']} and {st2['name']}")
                new_coords.append([st2['lat'], st2['lon']])
                
    net['coordinates'] = new_coords
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

print("Railway routing successful!")
