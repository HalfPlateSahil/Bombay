import httpx
import time

stations = [
    "Grant Road railway station Mumbai",
    "Mahim Junction railway station Mumbai",
    "Bandra railway station Mumbai",
    "Naigaon railway station Vasai",
    "Prabhadevi railway station Mumbai",
    "Lower Parel railway station Mumbai",
    "Matunga Road railway station Mumbai"
]

for s in stations:
    res = httpx.get(
        "https://nominatim.openstreetmap.org/search",
        params={"q": s, "format": "json", "limit": 1},
        headers={"User-Agent": "MumbaiAtlas/1.0"}
    )
    data = res.json()
    if data:
        print(f"{s}: lat {data[0]['lat']}, lon {data[0]['lon']}")
    else:
        print(f"{s}: NOT FOUND")
    time.sleep(1)
