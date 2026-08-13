import httpx
import json
import networkx as nx
import math
import pprint

def get_distance(p1, p2):
    return math.sqrt((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2)

# Get Western Line Relation
query_western = """[out:json];relation(11511059);out geom;"""
res = httpx.post("http://overpass-api.de/api/interpreter", data={"data": query_western}, headers={"User-Agent": "MumbaiAtlas/1.0"}, timeout=60)
data_western = res.json()

# Get Central Line Relation
query_central = """[out:json];relation(11514142);out geom;"""
res = httpx.post("http://overpass-api.de/api/interpreter", data={"data": query_central}, headers={"User-Agent": "MumbaiAtlas/1.0"}, timeout=60)
data_central = res.json()

# Get Harbour Line Relation (Mumbai CSMT to Panvel)
query_harbour = """[out:json];relation["route"="train"]["name"="Harbour Line: Mumbai CSMT → Panvel"](18.8, 72.7, 19.5, 73.1);out geom;"""
res = httpx.post("http://overpass-api.de/api/interpreter", data={"data": query_harbour}, headers={"User-Agent": "MumbaiAtlas/1.0"}, timeout=60)
data_harbour = res.json()

def build_graph_and_route(data, stations):
    G = nx.Graph()
    for element in data.get("elements", []):
        if element["type"] == "relation":
            for member in element.get("members", []):
                if member["type"] == "way" and "geometry" in member:
                    geom = member["geometry"]
                    for i in range(len(geom)-1):
                        p1 = (geom[i]["lat"], geom[i]["lon"])
                        p2 = (geom[i+1]["lat"], geom[i+1]["lon"])
                        dist = get_distance(p1, p2)
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
                # Fallback to straight line if graph disconnected
                new_coords.append([st2['lat'], st2['lon']])
    return new_coords

import sys
sys.path.append('.')
from backend.services.gis_service import RAILWAY_NETWORKS

new_networks = []
for net in RAILWAY_NETWORKS:
    stations = net['station_coords']
    if net['line'] == 'Western Line':
        coords = build_graph_and_route(data_western, stations)
    elif net['line'] == 'Central Line':
        coords = build_graph_and_route(data_central, stations)
    elif net['line'] == 'Harbour Line':
        coords = build_graph_and_route(data_harbour, stations)
    else:
        coords = net['coordinates']
        
    net['coordinates'] = coords
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

print("Routing completed and file rewritten!")
