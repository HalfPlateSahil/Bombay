import httpx
import json

def fetch_stations():
    overpass_url = "http://overpass-api.de/api/interpreter"
    overpass_query = """
    [out:json];
    (
      node["railway"="station"](18.9, 72.7, 19.5, 73.1);
      node["railway"="halt"](18.9, 72.7, 19.5, 73.1);
    );
    out center;
    """
    
    response = httpx.post(
        overpass_url, 
        data={'data': overpass_query},
        headers={'User-Agent': 'MumbaiAtlas/1.0', 'Accept': '*/*'},
        timeout=30.0
    )
    
    result = response.json()
    
    stations = {}
    for element in result['elements']:
        if 'tags' in element and 'name' in element['tags']:
            name = element['tags']['name']
            stations[name.lower()] = {
                'lat': element.get('lat', element.get('center', {}).get('lat')),
                'lon': element.get('lon', element.get('center', {}).get('lon'))
            }
            if 'name:en' in element['tags']:
                stations[element['tags']['name:en'].lower()] = {
                    'lat': element.get('lat', element.get('center', {}).get('lat')),
                    'lon': element.get('lon', element.get('center', {}).get('lon'))
                }
    return stations

if __name__ == "__main__":
    stations = fetch_stations()
    with open("overpass_stations.json", "w") as f:
        json.dump(stations, f, indent=2)
    print(f"Fetched {len(stations)} stations from Overpass.")
