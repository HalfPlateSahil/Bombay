import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

interface Stop {
  name: string;
  time: string;
  seconds: number;
}

interface TrainEntry {
  name: string;
  line: string;
  color?: string;
  direction?: string;
  stops: Stop[];
}

interface TrackData {
  coords: [number, number][]; // [lat, lon]
  cumDist: number[];
  totalDist: number;
  stations: Record<string, { lat: number; lon: number }>;
}

let trackCache: Record<string, TrackData> | null = null;
let timetableCache: TrainEntry[] | null = null;

function haversineDistMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rLat1 = (lat1 * Math.PI) / 180;
  const rLat2 = (lat2 * Math.PI) / 180;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371000.0 * c;
}

function calculateHeading(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rLat1 = (lat1 * Math.PI) / 180;
  const rLat2 = (lat2 * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(rLat2);
  const x = Math.cos(rLat1) * Math.sin(rLat2) - Math.sin(rLat1) * Math.cos(rLat2) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

function initData() {
  if (trackCache && timetableCache) return;

  try {
    const basePath = process.cwd();
    let gisPath = path.join(basePath, 'src', 'data', 'mumbai_gis.json');
    if (!fs.existsSync(gisPath)) {
      gisPath = path.join(basePath, 'frontend', 'src', 'data', 'mumbai_gis.json');
    }

    let ttPath = path.join(basePath, 'src', 'data', 'train_timetable.json');
    if (!fs.existsSync(ttPath)) {
      ttPath = path.join(basePath, 'frontend', 'src', 'data', 'train_timetable.json');
    }

    if (fs.existsSync(gisPath) && fs.existsSync(ttPath)) {
      const gisData = JSON.parse(fs.readFileSync(gisPath, 'utf-8'));
      timetableCache = JSON.parse(fs.readFileSync(ttPath, 'utf-8'));

      trackCache = {};
      for (const net of (gisData.railways || [])) {
        const lineName = net.line;
        const coords = net.coordinates as [number, number][];
        const cumDist: number[] = [0];
        let total = 0;

        for (let i = 1; i < coords.length; i++) {
          const d = haversineDistMeters(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
          total += d;
          cumDist.push(total);
        }

        const stationsMap: Record<string, { lat: number; lon: number }> = {};
        for (const st of (net.station_coords || [])) {
          stationsMap[st.name] = { lat: st.lat, lon: st.lon };
        }

        trackCache[lineName] = {
          coords,
          cumDist,
          totalDist: total,
          stations: stationsMap
        };
      }
    }
  } catch (e) {
    console.error("Error initializing train data:", e);
  }
}

function findClosestIndex(lat: number, lon: number, lineName: string): number {
  if (!trackCache || !trackCache[lineName]) return 0;
  const coords = trackCache[lineName].coords;
  let bestDist = Infinity;
  let bestIdx = 0;
  for (let i = 0; i < coords.length; i++) {
    const d = (coords[i][0] - lat) ** 2 + (coords[i][1] - lon) ** 2;
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function interpolateAlongTrack(idx1: number, idx2: number, progress: number, lineName: string): [number, number, number] {
  if (!trackCache || !trackCache[lineName]) return [0, 0, 0];
  const { coords, cumDist } = trackCache[lineName];
  const dist1 = cumDist[idx1];
  const dist2 = cumDist[idx2];
  const targetDist = dist1 + (dist2 - dist1) * progress;

  for (let i = 0; i < cumDist.length - 1; i++) {
    if (
      (cumDist[i] <= targetDist && targetDist <= cumDist[i + 1]) ||
      (cumDist[i] >= targetDist && targetDist >= cumDist[i + 1])
    ) {
      const segLen = cumDist[i + 1] - cumDist[i];
      if (segLen === 0) return [coords[i][0], coords[i][1], 0];
      const segProg = (targetDist - cumDist[i]) / segLen;
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const lat = p1[0] + (p2[0] - p1[0]) * segProg;
      const lon = p1[1] + (p2[1] - p1[1]) * segProg;
      const heading = dist2 >= dist1 ? calculateHeading(p1[0], p1[1], p2[0], p2[1]) : calculateHeading(p2[0], p2[1], p1[0], p1[1]);
      return [lat, lon, heading];
    }
  }

  return [coords[idx2][0], coords[idx2][1], 0];
}

export async function GET(request: Request) {
  initData();

  if (!trackCache || !timetableCache) {
    return NextResponse.json({ type: "FeatureCollection", features: [], metadata: { total: 0 } });
  }

  const { searchParams } = new URL(request.url);
  const simTimeParam = searchParams.get('sim_time');

  let currentSec: number;
  if (simTimeParam) {
    try {
      const parts = simTimeParam.split(':').map(Number);
      currentSec = parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
    } catch {
      const istNow = new Date(Date.now() + 5.5 * 3600000);
      currentSec = istNow.getUTCHours() * 3600 + istNow.getUTCMinutes() * 60 + istNow.getUTCSeconds();
    }
  } else {
    const istNow = new Date(Date.now() + 5.5 * 3600000);
    currentSec = istNow.getUTCHours() * 3600 + istNow.getUTCMinutes() * 60 + istNow.getUTCSeconds();
  }

  const features: any[] = [];
  let scheduleCount = 0;

  for (const train of timetableCache) {
    const stops = train.stops;
    if (!stops || stops.length < 2) continue;

    const startSec = stops[0].seconds;
    const endSec = stops[stops.length - 1].seconds;
    const lineName = train.line;

    if (!trackCache[lineName]) continue;

    if (startSec <= endSec) {
      if (!(startSec <= currentSec && currentSec <= endSec)) continue;
    } else {
      if (!(currentSec >= startSec || currentSec <= endSec)) continue;
    }

    let currentLat = 0;
    let currentLon = 0;
    let nextStation = "";
    let nextTime = "";
    let status = "In Transit";
    let heading = 0;
    let velocity = 0;
    let totalSegTime = 1;
    let idx1 = 0;
    let idx2 = 0;

    for (let i = 0; i < stops.length - 1; i++) {
      const s1 = stops[i];
      const s2 = stops[i + 1];
      let sec1 = s1.seconds;
      let sec2 = s2.seconds;
      if (sec2 < sec1) sec2 += 24 * 3600;

      let cSec = currentSec;
      if (cSec < sec1 && sec1 > 20 * 3600 && cSec < 4 * 3600) {
        cSec += 24 * 3600;
      }

      if (sec1 <= cSec && cSec <= sec2) {
        totalSegTime = sec2 - sec1;
        const progress = totalSegTime === 0 ? 0 : (cSec - sec1) / totalSegTime;

        const st1Coords = trackCache[lineName].stations[s1.name];
        const st2Coords = trackCache[lineName].stations[s2.name];
        const s1Lat = st1Coords?.lat ?? 19.0;
        const s1Lon = st1Coords?.lon ?? 72.8;
        const s2Lat = st2Coords?.lat ?? 19.0;
        const s2Lon = st2Coords?.lon ?? 72.8;

        idx1 = findClosestIndex(s1Lat, s1Lon, lineName);
        idx2 = findClosestIndex(s2Lat, s2Lon, lineName);

        let renderProgress = progress;
        if (progress < 0.1) {
          renderProgress = 0.0;
          status = "At Station";
          nextStation = s1.name;
          nextTime = s1.time;
        } else if (progress > 0.9) {
          renderProgress = 1.0;
          status = "At Station";
          nextStation = s2.name;
          nextTime = s2.time;
        } else {
          status = "In Transit";
          nextStation = s2.name;
          nextTime = s2.time;
        }

        const pos = interpolateAlongTrack(idx1, idx2, renderProgress, lineName);
        currentLat = pos[0];
        currentLon = pos[1];
        heading = pos[2];
        break;
      }
    }

    if (currentLat !== 0) {
      if (status === "In Transit" && totalSegTime > 0) {
        const d1 = trackCache[lineName].cumDist[idx1];
        const d2 = trackCache[lineName].cumDist[idx2];
        velocity = Math.abs(d2 - d1) / totalSegTime;
      }

      scheduleCount++;

      features.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [currentLon, currentLat]
        },
        properties: {
          id: train.name,
          line: lineName,
          color: train.color || "#ffffff",
          status,
          next_station: nextStation,
          next_time: nextTime,
          heading,
          velocity_ms: Math.round(velocity * 10) / 10,
          model_rotation: [0, 0, heading - 90],
          live_source: "schedule",
          train_number: train.name.match(/\((\d+)\)/)?.[1] || ""
        }
      });
    }
  }

  return NextResponse.json({
    type: "FeatureCollection",
    features,
    metadata: {
      gps_count: 0,
      schedule_count: scheduleCount,
      total: features.length,
      yatri_enabled: false
    }
  });
}

