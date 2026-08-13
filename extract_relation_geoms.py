import httpx
import json

query = """
[out:json];
(
  relation(11511059);
  relation(11514142);
  relation(11514143);
  relation(11514202);
  relation(11514203);
);
out geom;
"""

res = httpx.post(
    "http://overpass-api.de/api/interpreter", 
    data={"data": query}, 
    headers={"User-Agent": "MumbaiAtlas/1.0"},
    timeout=60
)
data = res.json()

lines = {}
for element in data.get("elements", []):
    if element["type"] == "relation":
        name = element["tags"].get("name", "")
        # collect all node coords
        coords = []
        for member in element.get("members", []):
            if member["type"] == "way" and "geometry" in member:
                for pt in member["geometry"]:
                    coords.append([pt["lat"], pt["lon"]])
        
        lines[name] = coords

print(f"Extracted {len(lines)} lines.")
for name, coords in lines.items():
    print(f"{name}: {len(coords)} points")

with open("relation_geometries.json", "w") as f:
    json.dump(lines, f)
