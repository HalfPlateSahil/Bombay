import pdfplumber
import json
import os
import re

STATION_MAP = {
    "M'BAI CENTRAL (L)": "Mumbai Central",
    "M'BAI CENTRAL(L)": "Mumbai Central",
    "Mahim Jn.": "Mahim",
    "Kandivli": "Kandivali",
    "Santa Cruz": "Santacruz",
    "Vile Parle": "Vile Parle",
    "Bhayander": "Bhayandar",
}

CODE_MAP = {
    "C": "Churchgate", "BVI": "Borivali", "VR": "Virar", "ADH": "Andheri",
    "GMN": "Goregaon", "MDD": "Malad", "BYR": "Bhayandar", "BSR": "Vasai Road",
    "BA": "Bandra", "NSP": "Nalla Sopara", "DRD": "Dadar", "BCL": "Mumbai Central"
}

STATION_COORDS = {
    "Churchgate": {"lat": 18.932, "lon": 72.826},
    "Marine Lines": {"lat": 18.94665, "lon": 72.82126},
    "Charni Road": {"lat": 18.96122, "lon": 72.81664},
    "Grant Road": {"lat": 18.97553, "lon": 72.82131},
    "Mumbai Central": {"lat": 18.98955, "lon": 72.82847},
    "Mahalaxmi": {"lat": 19.00358, "lon": 72.83563},
    "Lower Parel": {"lat": 19.0176, "lon": 72.84279},
    "Prabhadevi": {"lat": 19.03324, "lon": 72.84176},
    "Dadar": {"lat": 19.04894, "lon": 72.84049},
    "Matunga Road": {"lat": 19.06464, "lon": 72.84062},
    "Mahim": {"lat": 19.08035, "lon": 72.84164},
    "Bandra": {"lat": 19.09601, "lon": 72.84321},
    "Khar Road": {"lat": 19.11164, "lon": 72.84511},
    "Santacruz": {"lat": 19.1273, "lon": 72.84675},
    "Vile Parle": {"lat": 19.14298, "lon": 72.84818},
    "Andheri": {"lat": 19.15866, "lon": 72.84961},
    "Jogeshwari": {"lat": 19.17433, "lon": 72.85103},
    "Ram Mandir": {"lat": 19.19001, "lon": 72.85246},
    "Goregaon": {"lat": 19.20569, "lon": 72.85388},
    "Malad": {"lat": 19.22137, "lon": 72.85531},
    "Kandivali": {"lat": 19.23708, "lon": 72.85566},
    "Borivali": {"lat": 19.25281, "lon": 72.85499},
    "Dahisar": {"lat": 19.26854, "lon": 72.85433},
    "Mira Road": {"lat": 19.28427, "lon": 72.85366},
    "Bhayandar": {"lat": 19.3, "lon": 72.853},
    "Naigaon": {"lat": 19.349, "lon": 72.846},
    "Vasai Road": {"lat": 19.382, "lon": 72.832},
    "Nalla Sopara": {"lat": 19.417, "lon": 72.819},
    "Virar": {"lat": 19.455, "lon": 72.805}
}

def clean_station_name(name):
    if not name: return ""
    name = name.strip().upper()
    for st in STATION_COORDS.keys():
        if st.upper() in name:
            return st
    if "M'BAI" in name or "CENTRAL" in name: return "Mumbai Central"
    if "KANDIVLI" in name: return "Kandivali"
    if "SANTA CRUZ" in name: return "Santacruz"
    return ""

def time_to_seconds(t_str):
    if not t_str or ":" not in t_str: return None
    try:
        h, m = map(int, t_str.split(":"))
        return h * 3600 + m * 60
    except:
        return None

def process_pdf(filepath, direction):
    trains = []
    try:
        with pdfplumber.open(filepath) as pdf:
            for page_num, page in enumerate(pdf.pages):
                words = page.extract_words()
                
                # Extract headers (train codes and numbers)
                # Typically they are in the upper part of the page.
                # Let's find "STATIONS" or "DN TRAINS" / "UP TRAINS"
                station_top = None
                for w in words:
                    if w["text"] == "STATIONS":
                        station_top = w["top"]
                        break
                
                if not station_top: continue
                
                # Find the X coordinates of columns
                # The first column is stations, usually x0 < 100
                # Train columns are to the right. Let's group words around the station_top row.
                header_words = [w for w in words if abs(w["top"] - station_top) < 30]
                
                # Find station words
                # They are aligned on the left
                station_words = [w for w in words if w["x0"] < 150 and w["top"] > station_top + 30]
                
                # Group station names by top coordinate (tolerance ~5 pts)
                stations_by_top = []
                current_station_words = []
                last_top = None
                
                # Sort station words by top
                station_words.sort(key=lambda w: w["top"])
                
                for w in station_words:
                    if last_top is None or abs(w["top"] - last_top) > 5:
                        if current_station_words:
                            stations_by_top.append({
                                "top": sum(x["top"] for x in current_station_words) / len(current_station_words),
                                "name": clean_station_name(" ".join(x["text"] for x in current_station_words))
                            })
                        current_station_words = [w]
                        last_top = w["top"]
                    else:
                        current_station_words.append(w)
                
                if current_station_words:
                    stations_by_top.append({
                        "top": sum(x["top"] for x in current_station_words) / len(current_station_words),
                        "name": clean_station_name(" ".join(x["text"] for x in current_station_words))
                    })
                
                # Find train columns
                # Each train has a code (e.g., VR, BVI) and number (e.g., 90001) in header_words.
                # We can cluster header words by x coordinate.
                header_words.sort(key=lambda w: w["x0"])
                col_x_groups = []
                for w in header_words:
                    if w["x0"] > 150: # Ignore STATIONS column
                        matched = False
                        for g in col_x_groups:
                            if abs(g["x0"] - w["x0"]) < 20:
                                g["words"].append(w)
                                matched = True
                                break
                        if not matched:
                            col_x_groups.append({"x0": w["x0"], "words": [w]})
                
                # For each column, extract train info and times
                for col in col_x_groups:
                    col_words = col["words"]
                    col_words.sort(key=lambda w: w["top"])
                    code = col_words[0]["text"] if col_words else ""
                    train_num = col_words[1]["text"] if len(col_words) > 1 else ""
                    car_type = col_words[2]["text"] if len(col_words) > 2 else ""
                    
                    if not re.match(r"^\d+$", train_num) and len(col_words) > 2:
                        train_num = col_words[2]["text"]
                        
                    if not re.match(r"^\d+[A-Z]*$", train_num): continue
                    
                    # Find times in this column
                    # x0 should be close to col["x0"]
                    col_time_words = [w for w in words if abs(w["x0"] - col["x0"]) < 20 and w["top"] > station_top + 30]
                    
                    stops = []
                    is_ac = False
                    for tw in col_time_words:
                        if "AC" in tw["text"].upper() or "Condition" in tw["text"]: is_ac = True
                        sec = time_to_seconds(tw["text"])
                        if sec is not None:
                            # Match with station
                            best_station = None
                            best_dist = float('inf')
                            for st in stations_by_top:
                                dist = abs(st["top"] - tw["top"])
                                if dist < best_dist and dist < 10: # 10 pts tolerance
                                    best_dist = dist
                                    best_station = st
                            
                            if best_station and best_station.get("name"):
                                coords = STATION_COORDS.get(best_station["name"], {"lat": 0, "lon": 0})
                                stops.append({
                                    "name": best_station["name"],
                                    "time": tw["text"],
                                    "seconds": sec,
                                    "lat": coords["lat"],
                                    "lon": coords["lon"]
                                })
                                
                    if len(stops) < 2: continue
                    
                    # Ensure stops are sorted by time (wait, trains might cross midnight, so sort by top coordinate instead)
                    # The stops are already appended based on col_time_words which we should sort by top
                    stops.sort(key=lambda x: [s["top"] for s in stations_by_top if s["name"] == x["name"]][0])
                    
                    dest = stops[-1]["name"]
                    name = f"{dest} {train_num} {car_type}"
                    if is_ac or "AC" in code.upper():
                        name = f"{dest} AC Local ({train_num})"
                    elif dest:
                        name = f"{dest} Local ({train_num})"
                        
                    line = "Western Line"
                    color = "#06b6d4" if is_ac else "#3b82f6"
                    
                    trains.append({
                        "name": name,
                        "line": line,
                        "color": color,
                        "direction": direction,
                        "stops": stops
                    })
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
    return trains

if __name__ == "__main__":
    base_dir = os.path.join(os.path.dirname(__file__), "..")
    down_pdf = os.path.join(base_dir, "local train timetable", "mumbai local train western line down.pdf")
    up_pdf = os.path.join(base_dir, "local train timetable", "mumbai local train western line up.pdf")
    
    print("Processing DOWN trains...")
    down_trains = process_pdf(down_pdf, "DOWN")
    print(f"Found {len(down_trains)} DOWN trains.")
    
    print("Processing UP trains...")
    up_trains = process_pdf(up_pdf, "UP")
    print(f"Found {len(up_trains)} UP trains.")
    
    all_trains = down_trains + up_trains
    
    out_file = os.path.join(base_dir, "backend", "data", "train_timetable.json")
    with open(out_file, "w") as f:
        json.dump(all_trains, f, indent=2)
        
    print(f"Saved {len(all_trains)} trains to {out_file}")
