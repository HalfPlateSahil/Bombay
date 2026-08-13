import sys
sys.path.append('.')

import backend.services.train_service
import datetime

backend.services.train_service.datetime = type('Mock', (), {'utcnow': lambda: datetime.datetime(2026, 8, 9, 20, 11, 0)}) # 20:11 + 5:30 = 01:41 next day

geojson = backend.services.train_service.generate_live_trains_geojson()

for f in geojson['features']:
    if f['properties']['id'] == 'Borivali Local (91055)':
        print(f"Borivali Local properties: {f['properties']}")
        print(f"Coordinates: {f['geometry']['coordinates']}")
        break

# Let's inspect the logic manually
trains = backend.services.train_service.load_timetable()
current_sec = 1 * 3600 + 41 * 60

for train in trains:
    if train['name'] == 'Borivali Local (91055)':
        stops = train["stops"]
        for i in range(len(stops) - 1):
            s1 = stops[i]
            s2 = stops[i+1]
            sec1 = s1["seconds"]
            sec2 = s2["seconds"]
            
            if sec2 < sec1: sec2 += 24 * 3600
                
            c_sec = current_sec
            if c_sec < sec1 and sec1 > 20 * 3600 and c_sec < 4 * 3600:
                c_sec += 24 * 3600
                
            if sec1 <= c_sec <= sec2:
                print(f"MATCHED SEGMENT: {s1['name']} to {s2['name']}")
                total_seg_time = sec2 - sec1
                progress = 0 if total_seg_time == 0 else (c_sec - sec1) / total_seg_time
                print(f"Progress: {progress}")
                
                idx1 = backend.services.train_service.find_closest_index(s1["lat"], s1["lon"], "Western Line")
                idx2 = backend.services.train_service.find_closest_index(s2["lat"], s2["lon"], "Western Line")
                print(f"s1 lat: {s1['lat']}, s1 lon: {s1['lon']}, idx1: {idx1}")
                print(f"s2 lat: {s2['lat']}, s2 lon: {s2['lon']}, idx2: {idx2}")
                break
