import json
import networkx as nx
import math
import pprint

def get_distance(p1, p2):
    return math.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2)

def build_graph_from_flat_coords(coords_list, stations):
    G = nx.Graph()
    for i in range(len(coords_list) - 1):
        p1 = (coords_list[i][0], coords_list[i][1])
        p2 = (coords_list[i+1][0], coords_list[i+1][1])
        dist = get_distance(p1, p2)
        # Skip edges longer than ~500 meters (0.005 degrees) to remove false jumps
        if dist < 0.005:
            G.add_edge(p1, p2, weight=dist)

    def closest_node(lat, lon):
        min_dist = float('inf')
        best_node = None
        for node in G.nodes():
            d = get_distance((lat, lon), node)
            if d < min_dist:
                min_dist = d
                best_node = node
        return best_node

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
                print(f"No path between {st['name']} and {st2['name']}")
                new_coords.append([st2['lat'], st2['lon']])
    return new_coords

# Load saved geometries
with open("relation_geometries.json", "r") as f:
    rels = json.load(f)
with open("harbour_geometries.json", "r") as f:
    harbours = json.load(f)

import sys
sys.path.append('.')
from backend.services.gis_service import RAILWAY_NETWORKS

new_networks = []
for net in RAILWAY_NETWORKS:
    stations = net['station_coords']
    if net['line'] == 'Western Line':
        coords = rels["Western Line (Slow): Virar => Churchgate"]
        stitched = build_graph_from_flat_coords(coords, stations)
    elif net['line'] == 'Central Line':
        coords = rels["Central Line: Mumbai CSMT → Kasara (Fast)"]
        stitched = build_graph_from_flat_coords(coords, stations)
    elif net['line'] == 'Harbour Line':
        coords = harbours["Harbour Line: Mumbai CSMT → Panvel"]
        stitched = build_graph_from_flat_coords(coords, stations)
    else:
        stitched = net['coordinates']
        
    net['coordinates'] = stitched
    print(f"{net['line']}: Stitched {len(stitched)} points.")
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

print("Stitching completed and file rewritten!")
