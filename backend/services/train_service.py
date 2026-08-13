import time
import math
import json
import os
import re
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple

from backend.services.gis_service import RAILWAY_NETWORKS
from backend.services.yatri_service import fetch_live_locations, get_yatri_diagnostics
from backend.config import settings

logger = logging.getLogger(__name__)

# Cache the timetable in memory
_TIMETABLE_CACHE = None
# Cache track distances and indices
_TRACK_CACHE = {}
# Cache previous GPS locations to calculate true velocity
_TRAIN_HISTORY = {}

def build_track_cache():
    global _TRACK_CACHE
    if _TRACK_CACHE: return
    
    for network in RAILWAY_NETWORKS:
        line_name = network["line"]
        coords = network["coordinates"]
        
        # Calculate cumulative distance along the line string
        cum_dist = [0.0]
        total = 0.0
        for i in range(1, len(coords)):
            p1 = coords[i-1]
            p2 = coords[i]
            # p is [lat, lon]
            lat1, lon1, lat2, lon2 = map(math.radians, [p1[0], p1[1], p2[0], p2[1]])
            dlon = lon2 - lon1
            dlat = lat2 - lat1
            a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
            c = 2 * math.asin(math.sqrt(a))
            dist = c * 6371000.0
            total += dist
            cum_dist.append(total)
            
        _TRACK_CACHE[line_name] = {
            "coords": coords,
            "cum_dist": cum_dist,
            "total_dist": total,
            "stations": {s["name"]: s for s in network.get("station_coords", [])}
        }

def find_closest_index(lat: float, lon: float, line_name: str) -> int:
    track = _TRACK_CACHE.get(line_name)
    if not track: return 0
    
    best_dist = float('inf')
    best_idx = 0
    for i, p in enumerate(track["coords"]):
        # p is [lat, lon]
        d = (p[0] - lat)**2 + (p[1] - lon)**2
        if d < best_dist:
            best_dist = d
            best_idx = i
    return best_idx

def load_timetable():
    global _TIMETABLE_CACHE
    if _TIMETABLE_CACHE is None:
        file_path = os.path.join(os.path.dirname(__file__), "..", "data", "train_timetable.json")
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                _TIMETABLE_CACHE = json.load(f)
        except Exception as e:
            print(f"Error loading train timetable: {e}")
            _TIMETABLE_CACHE = []
    return _TIMETABLE_CACHE

def calculate_heading(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlon = lon2 - lon1
    y = math.sin(dlon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    brng = math.degrees(math.atan2(y, x))
    return (brng + 360) % 360

def interpolate_along_track(idx1: int, idx2: int, progress: float, line_name: str):
    track = _TRACK_CACHE[line_name]
    coords = track["coords"]
    cum_dist = track["cum_dist"]
    
    dist1 = cum_dist[idx1]
    dist2 = cum_dist[idx2]
    
    target_dist = dist1 + (dist2 - dist1) * progress
    
    # Direction doesn't matter for the search since cum_dist is always increasing
    # We just find the segment where target_dist falls
    for i in range(len(cum_dist) - 1):
        if cum_dist[i] <= target_dist <= cum_dist[i+1] or cum_dist[i] >= target_dist >= cum_dist[i+1]:
            # It's in this segment
            segment_len = cum_dist[i+1] - cum_dist[i]
            if segment_len == 0: return coords[i]
            
            seg_prog = (target_dist - cum_dist[i]) / segment_len
            p1 = coords[i]
            p2 = coords[i+1]
            inter_lat = p1[0] + (p2[0] - p1[0]) * seg_prog
            inter_lon = p1[1] + (p2[1] - p1[1]) * seg_prog
            
            if dist2 >= dist1:
                heading = calculate_heading(p1[0], p1[1], p2[0], p2[1])
            else:
                heading = calculate_heading(p2[0], p2[1], p1[0], p1[1])
                
            return [inter_lat, inter_lon, heading]
            
    return [coords[idx2][0], coords[idx2][1], 0.0]


def extrapolate_along_track_dist(line_name: str, target_dist: float) -> Tuple[float, float, float]:
    """Finds the exact lat, lon, and heading at a specific physical distance along the track polyline."""
    track = _TRACK_CACHE.get(line_name)
    if not track: return (0.0, 0.0, 0.0)
    
    cum_dist = track["cum_dist"]
    coords = track["coords"]
    
    if target_dist <= cum_dist[0]:
        return (coords[0][0], coords[0][1], 0.0)
    if target_dist >= cum_dist[-1]:
        return (coords[-1][0], coords[-1][1], 0.0)
        
    for i in range(len(cum_dist) - 1):
        if cum_dist[i] <= target_dist <= cum_dist[i+1]:
            segment_len = cum_dist[i+1] - cum_dist[i]
            if segment_len == 0: return (coords[i][0], coords[i][1], 0.0)
            
            seg_prog = (target_dist - cum_dist[i]) / segment_len
            p1 = coords[i]
            p2 = coords[i+1]
            inter_lat = p1[0] + (p2[0] - p1[0]) * seg_prog
            inter_lon = p1[1] + (p2[1] - p1[1]) * seg_prog
            heading = calculate_heading(p1[0], p1[1], p2[0], p2[1])
            return (inter_lat, inter_lon, heading)
    return (0.0, 0.0, 0.0)


def _extract_train_number(name: str) -> Optional[str]:
    """Extract the numeric train number from a name like 'Borivali Local (90001)'."""
    m = re.search(r'\((\d+)\)', name)
    return m.group(1) if m else None


def _snap_to_track(lat: float, lon: float, line_name: str) -> Tuple[float, float, float]:
    """
    Snap a GPS coordinate to the nearest point on the track polyline.
    Returns (snapped_lat, snapped_lon, heading).
    This prevents GPS jitter from making trains float off-track.
    """
    track = _TRACK_CACHE.get(line_name)
    if not track:
        return (lat, lon, 0.0)
    
    coords = track["coords"]
    best_dist = float('inf')
    best_lat = lat
    best_lon = lon
    best_heading = 0.0
    
    for i in range(len(coords) - 1):
        p1 = coords[i]
        p2 = coords[i + 1]
        
        # Project point onto segment p1-p2
        dx = p2[0] - p1[0]
        dy = p2[1] - p1[1]
        seg_len_sq = dx * dx + dy * dy
        
        if seg_len_sq < 1e-12:
            # Degenerate segment
            proj_lat, proj_lon = p1[0], p1[1]
        else:
            t = max(0, min(1, ((lat - p1[0]) * dx + (lon - p1[1]) * dy) / seg_len_sq))
            proj_lat = p1[0] + t * dx
            proj_lon = p1[1] + t * dy
        
        d = (proj_lat - lat) ** 2 + (proj_lon - lon) ** 2
        if d < best_dist:
            best_dist = d
            best_lat = proj_lat
            best_lon = proj_lon
            best_heading = calculate_heading(p1[0], p1[1], p2[0], p2[1])
    
    return (best_lat, best_lon, best_heading)


def _get_active_train_numbers(trains: list, current_sec: int) -> Dict[str, dict]:
    """
    Determine which train numbers should be active right now based on schedule,
    with the safety window applied. Returns dict of train_number -> train entry.
    """
    safety_before = settings.YATRI_SAFETY_WINDOW_BEFORE * 60  # to seconds
    safety_after = settings.YATRI_SAFETY_WINDOW_AFTER * 60

    active = {}
    for train in trains:
        stops = train.get("stops", [])
        if len(stops) < 2:
            continue
        
        train_number = _extract_train_number(train.get("name", ""))
        if not train_number:
            continue

        start_sec = stops[0]["seconds"] - safety_before
        end_sec = stops[-1]["seconds"] + safety_after

        # Handle midnight wraparound
        if stops[0]["seconds"] <= stops[-1]["seconds"]:
            # Normal case
            if start_sec <= current_sec <= end_sec:
                active[train_number] = train
        else:
            # Crosses midnight
            if current_sec >= start_sec or current_sec <= end_sec:
                active[train_number] = train

    return active


async def generate_live_trains_geojson(sim_time: str = None, yatri_enabled: bool = True) -> Dict[str, Any]:
    build_track_cache()
    trains = load_timetable()
    features = []
    
    if sim_time:
        try:
            parts = list(map(int, sim_time.split(':')))
            hours = parts[0]
            mins = parts[1]
            secs = parts[2] if len(parts) > 2 else 0
            current_sec = hours * 3600 + mins * 60 + secs
        except:
            now = datetime.utcnow() + timedelta(hours=5, minutes=30)
            current_sec = now.hour * 3600 + now.minute * 60 + now.second
    else:
        now = datetime.utcnow() + timedelta(hours=5, minutes=30)
        current_sec = now.hour * 3600 + now.minute * 60 + now.second

    # ── Fetch Yatri GPS data for active trains ──────────────────────────
    gps_data: Dict[str, Dict] = {}
    yatri_active = yatri_enabled and settings.YATRI_ENABLED and not sim_time  # Disable GPS for sim mode

    if yatri_active:
        active_trains = _get_active_train_numbers(trains, current_sec)
        active_numbers = list(active_trains.keys())
        
        if active_numbers:
            try:
                gps_data = await fetch_live_locations(active_numbers)
                logger.info(
                    f"[TrainService] Yatri GPS: {len(gps_data)} live / {len(active_numbers)} queried"
                )
            except Exception as e:
                logger.error(f"[TrainService] Yatri fetch failed: {e}")

    # ── Generate GeoJSON features ───────────────────────────────────────
    gps_used_count = 0
    schedule_used_count = 0

    for train in trains:
        stops = train["stops"]
        if len(stops) < 2: continue
        
        start_sec = stops[0]["seconds"]
        end_sec = stops[-1]["seconds"]
        line_name = train.get("line", "")
        
        if line_name not in _TRACK_CACHE:
            continue
            
        if start_sec <= end_sec:
            if not (start_sec <= current_sec <= end_sec): continue
        else:
            if not (current_sec >= start_sec or current_sec <= end_sec): continue
                
        train_number = _extract_train_number(train.get("name", ""))
        
        # ── Check if we have GPS data for this train ────────────────────
        gps_loc = gps_data.get(train_number) if train_number else None
        
        if gps_loc and gps_loc.get("latitude", 0) != 0 and gps_loc.get("longitude", 0) != 0:
            # ── USE LIVE GPS ────────────────────────────────────────────
            raw_lat = gps_loc["latitude"]
            raw_lon = gps_loc["longitude"]
            
            # Snap GPS coordinate to track polyline
            snapped_lat, snapped_lon, heading = _snap_to_track(raw_lat, raw_lon, line_name)
            
            # Find the nearest station in our track cache
            best_st_dist = float('inf')
            nearest_st_name = ""
            nearest_st_lat = snapped_lat
            nearest_st_lon = snapped_lon
            
            stations = _TRACK_CACHE.get(line_name, {}).get("stations", {})
            for st_name, st_data in stations.items():
                d = (st_data["lat"] - snapped_lat)**2 + (st_data["lon"] - snapped_lon)**2
                if d < best_st_dist:
                    best_st_dist = d
                    nearest_st_name = st_name
                    nearest_st_lat = st_data["lat"]
                    nearest_st_lon = st_data["lon"]

            # Train status from Yatri: 0 = running, 1 = at station
            yatri_status = gps_loc.get("train_status", -1)
            status = "At Station" if yatri_status == 1 else "In Transit"
            
            # 1. STATION SNAPPING: If at station, snap exactly to station coordinates to fix misalignment
            if yatri_status == 1 and nearest_st_name:
                st_snapped_lat, st_snapped_lon, _ = _snap_to_track(nearest_st_lat, nearest_st_lon, line_name)
                snapped_lat = st_snapped_lat
                snapped_lon = st_snapped_lon
                
            # 2. PHYSICALLY ACCURATE STATION LOGIC
            train_idx = find_closest_index(snapped_lat, snapped_lon, line_name)
            train_dist = _TRACK_CACHE[line_name]["cum_dist"][train_idx]
            
            direction = train.get("direction", "DOWN")
            phys_next_station = ""
            phys_prev_station = ""
            next_time = ""
            
            for stop in stops:
                st_data = stations.get(stop["name"])
                if not st_data: continue
                st_idx = find_closest_index(st_data["lat"], st_data["lon"], line_name)
                st_dist = _TRACK_CACHE[line_name]["cum_dist"][st_idx]
                
                if direction == "DOWN":
                    if st_dist > train_dist + 50:
                        phys_next_station = stop["name"]
                        next_time = stop["time"]
                        break
                    phys_prev_station = stop["name"]
                else:
                    if st_dist < train_dist - 50:
                        phys_next_station = stop["name"]
                        next_time = stop["time"]
                        break
                    phys_prev_station = stop["name"]
            
            if not phys_next_station and len(stops) > 0:
                phys_next_station = stops[-1]["name"]
                next_time = stops[-1]["time"]
                
            # 3. VELOCITY: Calculate robust true velocity from history
            now_ts = time.time()
            true_velocity = 12.0
            history = _TRAIN_HISTORY.get(train_number)
            
            if history:
                if raw_lat != history["raw_lat"] or raw_lon != history["raw_lon"]:
                    dt_s = now_ts - history["time"]
                    if 0 < dt_s < 300: # Valid within 5 mins
                        dist = abs(train_dist - history["train_dist"])
                        true_velocity = dist / dt_s
                else:
                    true_velocity = history.get("velocity", 12.0)
            
            # Update history only if GPS actually changed
            if not history or history["raw_lat"] != raw_lat or history["raw_lon"] != raw_lon:
                _TRAIN_HISTORY[train_number] = {
                    "train_dist": train_dist,
                    "raw_lat": raw_lat,
                    "raw_lon": raw_lon,
                    "time": now_ts,
                    "velocity": true_velocity
                }
            
            # Cap true velocity to sensible limits (2 to 30 m/s ~ 108 km/h) to keep train moving reasonably
            true_velocity = max(2.0, min(30.0, true_velocity))
            velocity = 0.0 if status == "At Station" else true_velocity

            # 4. EXTRAPOLATE ALONG TRACK: Project the train's position forward if GPS data is stale
            if history and velocity > 0:
                dt_s = now_ts - history["time"]
                if 0 < dt_s < 15: # Safely extrapolate up to 15 seconds (tight with 8s polling)
                    extra_dist = velocity * dt_s
                    extrap_dist = train_dist + (extra_dist if direction == "DOWN" else -extra_dist)
                    
                    ex_lat, ex_lon, ex_heading = extrapolate_along_track_dist(line_name, extrap_dist)
                    if ex_lat != 0.0:
                        snapped_lat, snapped_lon, heading = ex_lat, ex_lon, ex_heading
                        train_dist = extrap_dist

            # 5. STATUS TEXT: Generate perfectly synced physical status text
            nearest_st_idx = find_closest_index(nearest_st_lat, nearest_st_lon, line_name)
            nearest_st_dist = _TRACK_CACHE[line_name]["cum_dist"][nearest_st_idx]
            dist_to_nearest = abs(train_dist - nearest_st_dist)

            
            if status == "At Station" or (dist_to_nearest < 100 and true_velocity < 5.0):
                status_text = f"Stopped at {nearest_st_name}"
            else:
                if dist_to_nearest < 250:
                    if direction == "DOWN":
                        status_text = f"Arriving at {nearest_st_name}" if train_dist < nearest_st_dist else f"Departed from {nearest_st_name}"
                    else:
                        status_text = f"Arriving at {nearest_st_name}" if train_dist > nearest_st_dist else f"Departed from {nearest_st_name}"
                else:
                    status_text = f"Approaching {phys_next_station}"

            gps_used_count += 1

            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [snapped_lon, snapped_lat]
                },
                "properties": {
                    "id": train["name"],
                    "line": line_name,
                    "color": train.get("color", "#ffffff"),
                    "status": status,
                    "status_text": status_text,
                    "next_station": phys_next_station,
                    "next_time": next_time,
                    "heading": heading,
                    "velocity_ms": velocity,
                    "model_rotation": [0, 0, heading - 90],
                    # ── Yatri GPS metadata ──
                    "live_source": "yatri_gps",
                    "train_number": train_number,
                    "train_status": yatri_status,
                    "train_accuracy": gps_loc.get("train_accuracy_status", -1),
                    "live_time": gps_loc.get("time", ""),
                    "yatri_station_id": gps_loc.get("nearest_station_id", ""),
                    "gps_raw_lat": raw_lat,
                    "gps_raw_lon": raw_lon,
                }
            })
        else:
            # ── FALLBACK TO SCHEDULE ────────────────────────────────────
            current_lat = 0.0
            current_lon = 0.0
            next_station = ""
            next_time = ""
            status = "In Transit"
            heading = 0.0
            velocity = 0
            total_seg_time = 1
            idx1 = 0
            idx2 = 0
            
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
                    total_seg_time = sec2 - sec1
                    progress = 0 if total_seg_time == 0 else (c_sec - sec1) / total_seg_time
                    
                    st1_c = _TRACK_CACHE.get(line_name, {}).get("stations", {}).get(s1["name"])
                    st2_c = _TRACK_CACHE.get(line_name, {}).get("stations", {}).get(s2["name"])
                    s1_lat = st1_c["lat"] if st1_c else s1["lat"]
                    s1_lon = st1_c["lon"] if st1_c else s1["lon"]
                    s2_lat = st2_c["lat"] if st2_c else s2["lat"]
                    s2_lon = st2_c["lon"] if st2_c else s2["lon"]
                    
                    idx1 = find_closest_index(s1_lat, s1_lon, line_name)
                    idx2 = find_closest_index(s2_lat, s2_lon, line_name)

                    render_progress = progress
                    if progress < 0.1:
                        render_progress = 0.0
                        status = "At Station"
                        next_station, next_time = s1["name"], s1["time"]
                    elif progress > 0.9:
                        render_progress = 1.0
                        status = "At Station"
                        next_station, next_time = s2["name"], s2["time"]
                    else:
                        status = "In Transit"
                        next_station, next_time = s2["name"], s2["time"]
                        
                    pos = interpolate_along_track(idx1, idx2, render_progress, line_name)
                    current_lat, current_lon = pos[0], pos[1]
                    heading = pos[2] if len(pos) > 2 else 0.0
                    break
                    
            if current_lat != 0.0:
                # Estimate velocity for frontend animation
                velocity = 0
                if status == "In Transit" and total_seg_time > 0:
                    d1 = _TRACK_CACHE[line_name]["cum_dist"][idx1]
                    d2 = _TRACK_CACHE[line_name]["cum_dist"][idx2]
                    distance = abs(d2 - d1)
                    velocity = distance / total_seg_time

                schedule_used_count += 1

                features.append({
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [current_lon, current_lat]
                    },
                    "properties": {
                        "id": train["name"],
                        "line": line_name,
                        "color": train.get("color", "#ffffff"),
                        "status": status,
                        "next_station": next_station,
                        "next_time": next_time,
                        "heading": heading,
                        "velocity_ms": velocity,
                        "model_rotation": [0, 0, heading - 90],
                        # ── Schedule source metadata ──
                        "live_source": "schedule",
                        "train_number": train_number or "",
                    }
                })

    if yatri_active and (gps_used_count > 0 or len(gps_data) > 0):
        logger.info(
            f"[TrainService] Rendered {gps_used_count} GPS + {schedule_used_count} schedule trains "
            f"({len(features)} total features)"
        )

    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "gps_count": gps_used_count,
            "schedule_count": schedule_used_count,
            "total": len(features),
            "yatri_enabled": yatri_active,
        }
    }
