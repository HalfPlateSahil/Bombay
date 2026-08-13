import urllib.request
import json
import time

def search_osm(query):
    url = "https://nominatim.openstreetmap.org/search?q=" + urllib.parse.quote(query) + "&format=json&limit=5"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            for item in data:
                print(f"[{item['type']}] {item['display_name']} -> Lat: {item['lat']}, Lon: {item['lon']}")
    except Exception as e:
        print("Error:", e)

print("--- Dadar ---")
search_osm("Dadar Railway Station, Mumbai")
time.sleep(1)
print("\n--- Santacruz ---")
search_osm("Santacruz Railway Station, Mumbai")
time.sleep(1)
print("\n--- Jogeshwari ---")
search_osm("Jogeshwari Railway Station, Mumbai")
