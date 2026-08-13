import httpx

query = """
[out:json][timeout:90];
(
  relation["network"="Mumbai Suburban Railway"](18.8, 72.7, 19.5, 73.1);
);
out geom;
"""

res = httpx.post(
    "http://overpass-api.de/api/interpreter", 
    data={"data": query}, 
    headers={"User-Agent": "MumbaiAtlas/1.0"}
)

print(res.status_code)
try:
    print(len(res.json()["elements"]))
except Exception as e:
    print(res.text[:500])
