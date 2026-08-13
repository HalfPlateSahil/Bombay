import httpx

query = """
[out:json];
relation(11511059);
out geom;
"""

res = httpx.post(
    "http://overpass-api.de/api/interpreter", 
    data={"data": query}, 
    headers={"User-Agent": "MumbaiAtlas/1.0"},
    timeout=60
)
print("Status:", res.status_code)
try:
    print("Found elements:", len(res.json().get("elements", [])))
except Exception as e:
    print(res.text[:500])
