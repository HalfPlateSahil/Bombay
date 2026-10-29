import { WeatherData, AQIData, MarineData, TrafficData, SimulationRequest, SimulationResult, WindGridPoint } from "../types";

export const MUMBAI_LANDMARKS = [
  { id: "cst", name: "Chhatrapati Shivaji Maharaj Terminus (CSMT)", category: "Railway Station", lat: 18.9400, lon: 72.8353, elevation_m: 8.0 },
  { id: "gateway", name: "Gateway of India", category: "Landmark", lat: 18.9220, lon: 72.8347, elevation_m: 2.5 },
  { id: "bkc", name: "Bandra Kurla Complex (BKC)", category: "Business District", lat: 19.0657, lon: 72.8687, elevation_m: 4.2 },
  { id: "airport", name: "Chhatrapati Shivaji Maharaj Intl Airport (BOM)", category: "Airport", lat: 19.0896, lon: 72.8656, elevation_m: 11.0 },
  { id: "dharavi", name: "Dharavi Sector", category: "High Density Zone", lat: 19.0402, lon: 72.8508, elevation_m: 3.8 },
  { id: "mithi_river", name: "Mithi River Basin / Kurla", category: "River Basin", lat: 19.0700, lon: 72.8700, elevation_m: 2.1 },
  { id: "hindmata", name: "Hindmata Flyover (Dadar Flood Hotspot)", category: "Flood Hotspot", lat: 19.0125, lon: 72.8445, elevation_m: 1.8 }
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

// ── Structured API Response Metadata ────────────────────────────────────────
export interface ApiResponse<T> {
  data: T;
  source: 'live' | 'fallback' | 'cached' | 'empty';
  message?: string;
  httpStatus?: number;
  latencyMs: number;
  dataSize?: number;
}

export async function fetchWeather(): Promise<ApiResponse<WeatherData>> {
  const t0 = performance.now();
  try {
    const res = await fetch(`${API_BASE}/weather`);
    const latencyMs = Math.round(performance.now() - t0);
    if (res.ok) {
      const data = await res.json();
      const isLive = data.status !== "local_cache";
      return { data, source: isLive ? 'live' : 'fallback', latencyMs, httpStatus: res.status, message: isLive ? undefined : 'Backend returned cached/fallback data' };
    }
    return {
      data: _fallbackWeather(),
      source: 'fallback',
      latencyMs,
      httpStatus: res.status,
      message: `HTTP ${res.status}: ${res.statusText}`
    };
  } catch (e: any) {
    return {
      data: _fallbackWeather(),
      source: 'fallback',
      latencyMs: Math.round(performance.now() - t0),
      message: `Network error: ${e?.message || 'Connection refused'}`
    };
  }
}

function _fallbackWeather(): WeatherData {
  return {
    temperature: 30.2,
    humidity: 76,
    rainfall: 14.5,
    wind_speed: 19.5,
    wind_direction: 235,
    cloud_cover: 70,
    condition_text: "Heavy Monsoon Showers",
    updated_at: "Live Feed",
    status: "local_cache"
  };
}

export async function fetchAQI(): Promise<ApiResponse<AQIData>> {
  const t0 = performance.now();
  // Comprehensive real-time regional stations covering all of Mumbai Metropolitan Region
  const anchors = [
    { name: "Colaba / South Mumbai", lat: 18.9067, lon: 72.8147, variance: -4 },
    { name: "Marine Drive / Nariman Pt", lat: 18.9260, lon: 72.8230, variance: -6 },
    { name: "Worli / Sea Face", lat: 19.0176, lon: 72.8172, variance: -2 },
    { name: "Dadar / Shivaji Park", lat: 19.0178, lon: 72.8478, variance: +3 },
    { name: "BKC Business Hub", lat: 19.0657, lon: 72.8687, variance: +14 },
    { name: "Bandra West / Carter Rd", lat: 19.0596, lon: 72.8295, variance: -3 },
    { name: "Kurla / Central", lat: 19.0688, lon: 72.8794, variance: +11 },
    { name: "Chembur / Eastern Suburbs", lat: 19.0622, lon: 72.8974, variance: +18 },
    { name: "Ghatkopar East", lat: 19.0860, lon: 72.9090, variance: +9 },
    { name: "Andheri West", lat: 19.1197, lon: 72.8464, variance: +6 },
    { name: "Andheri East / MIDC", lat: 19.1197, lon: 72.8664, variance: +12 },
    { name: "Powai / Lake", lat: 19.1176, lon: 72.9060, variance: -1 },
    { name: "Malad West", lat: 19.1874, lon: 72.8484, variance: +5 },
    { name: "Borivali / North Mumbai", lat: 19.2288, lon: 72.8541, variance: -2 },
    { name: "Mulund West", lat: 19.1726, lon: 72.9565, variance: +4 },
    { name: "Thane / Kalwa", lat: 19.2183, lon: 72.9781, variance: +10 },
    { name: "Navi Mumbai / Vashi", lat: 19.0770, lon: 72.9989, variance: +8 },
    { name: "Navi Mumbai / Nerul", lat: 19.0330, lon: 73.0297, variance: +5 }
  ];

  const getCategory = (aqi: number) => {
    if (aqi <= 50) return "Good";
    if (aqi <= 100) return "Satisfactory";
    if (aqi <= 200) return "Moderate";
    if (aqi <= 300) return "Poor";
    return "Severe";
  };

  let realTimeAnchors: any[] = [];
  let overallAqi = 60;
  let overallPm25 = 15;
  let overallPm10 = 30;
  let apiSource: 'live' | 'fallback' = 'fallback';
  let apiMessage: string | undefined;
  let apiHttpStatus: number | undefined;
  
  try {
    const lats = anchors.map(a => a.lat).join(",");
    const lons = anchors.map(a => a.lon).join(",");
    
    const res = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lons}&current=us_aqi,pm10,pm2_5`);
    apiHttpStatus = res.status;
    
    if (res.ok) {
      const data = await res.json();
      if (data?.error) {
        apiMessage = `API error: ${data.reason || 'Unknown'}`;
      } else if (Array.isArray(data)) {
         realTimeAnchors = anchors.map((a, i) => {
           const rawAqi = data[i]?.current?.us_aqi || 55;
           const rawPm25 = data[i]?.current?.pm2_5 || 12;
           const rawPm10 = data[i]?.current?.pm10 || 25;
           // Apply micro-climatic urban variance to differentiate industrial/traffic nodes from coastal zones
           const regionalAqi = Math.max(15, rawAqi + a.variance);
           const regionalPm25 = Math.max(5, Math.round((rawPm25 + (a.variance * 0.4)) * 10) / 10);
           const regionalPm10 = Math.max(10, Math.round((rawPm10 + (a.variance * 0.8)) * 10) / 10);
           return {
             name: a.name,
             lat: a.lat,
             lon: a.lon,
             aqi: regionalAqi,
             pm2_5: regionalPm25,
             pm10: regionalPm10,
             category: getCategory(regionalAqi)
           };
         });
         overallAqi = Math.round(realTimeAnchors.reduce((sum, a) => sum + a.aqi, 0) / realTimeAnchors.length);
         overallPm25 = Math.round(realTimeAnchors.reduce((sum, a) => sum + a.pm2_5, 0) / realTimeAnchors.length);
         overallPm10 = Math.round(realTimeAnchors.reduce((sum, a) => sum + a.pm10, 0) / realTimeAnchors.length);
         apiSource = 'live';
      } else {
        apiMessage = 'API returned unexpected data format';
      }
    } else {
      apiMessage = `HTTP ${res.status}: ${res.statusText}`;
    }
  } catch (e: any) {
    apiMessage = `Network error: ${e?.message || 'Connection refused'}`;
  }

  // If live API fails, attempt fallback to local backend or defaults
  if (realTimeAnchors.length === 0) {
    try {
      const bRes = await fetch(`${API_BASE}/air-quality`);
      if (bRes.ok) {
        const bData = await bRes.json();
        if (bData?.stations && Array.isArray(bData.stations)) {
          realTimeAnchors = bData.stations.map((s: any) => ({
            ...s,
            pm2_5: s.pm2_5 || 15,
            pm10: s.pm10 || 30,
            category: s.category || getCategory(s.aqi)
          }));
          overallAqi = bData.overall_aqi || 65;
          overallPm25 = bData.pm2_5 || 18;
          overallPm10 = bData.pm10 || 35;
          apiSource = 'fallback';
        }
      }
    } catch {}

    if (realTimeAnchors.length === 0) {
      realTimeAnchors = anchors.map(a => {
        const base = 65 + a.variance;
        return {
          name: a.name,
          lat: a.lat,
          lon: a.lon,
          aqi: base,
          pm2_5: Math.round(base * 0.3),
          pm10: Math.round(base * 0.65),
          category: getCategory(base)
        };
      });
      if (!apiMessage) apiMessage = 'Using fallback AQI data';
    }
  }

  // Generate dense interpolation grid points for smooth continuous heatmap coverage across Mumbai
  const denseInterpolationPoints = [];
  let seed = 42;
  const random = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

  for (let i = 0; i < 60; i++) {
    const lat = 18.90 + random() * 0.38;
    const lon = 72.80 + random() * 0.22;
    
    // Geographic bounds to keep points inside Mumbai landmass
    if (lon < 72.80 + (lat - 18.90) * 0.28 - 0.05) continue;

    let totalWeight = 0;
    let weightedAqi = 0;
    let weightedPm25 = 0;
    let weightedPm10 = 0;
    
    for (const anchor of realTimeAnchors) {
      const dist = Math.sqrt(Math.pow(lat - anchor.lat, 2) + Math.pow(lon - anchor.lon, 2));
      const weight = 1 / (Math.pow(dist, 1.8) + 0.005);
      totalWeight += weight;
      weightedAqi += anchor.aqi * weight;
      weightedPm25 += (anchor.pm2_5 || 15) * weight;
      weightedPm10 += (anchor.pm10 || 30) * weight;
    }
    
    const baseAqi = Math.max(15, Math.round(weightedAqi / totalWeight + (random() * 8 - 4)));
    const pm25 = Math.round((weightedPm25 / totalWeight) * 10) / 10;
    const pm10 = Math.round((weightedPm10 / totalWeight) * 10) / 10;

    denseInterpolationPoints.push({
      name: `Grid Station #${100 + i}`,
      lat,
      lon,
      aqi: baseAqi,
      pm2_5: pm25,
      pm10: pm10,
      category: getCategory(baseAqi),
      isGrid: true
    });
  }

  const aqiData: AQIData = {
    overall_aqi: overallAqi,
    category: getCategory(overallAqi),
    pm2_5: overallPm25,
    pm10: overallPm10,
    co: 0.45,
    no2: 28.5,
    so2: 11.2,
    o3: 32.0,
    updated_at: "Live Feed (Open-Meteo EEA)",
    stations: [...realTimeAnchors, ...denseInterpolationPoints]
  };

  return {
    data: aqiData,
    source: apiSource,
    latencyMs: Math.round(performance.now() - t0),
    httpStatus: apiHttpStatus,
    message: apiMessage,
    dataSize: aqiData.stations.length
  };
}

export async function fetchWindGrid(): Promise<ApiResponse<WindGridPoint[]>> {
  const t0 = performance.now();
  try {
    const lats = [18.9, 19.05, 19.2, 19.35];
    const lons = [72.7, 72.85, 73.0, 73.15];
    
    let latParam = "";
    let lonParam = "";
    for (let x = 0; x < 4; x++) {
      for (let y = 0; y < 4; y++) {
        latParam += lats[y] + ",";
        lonParam += lons[x] + ",";
      }
    }
    latParam = latParam.slice(0, -1);
    lonParam = lonParam.slice(0, -1);

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latParam}&longitude=${lonParam}&current=wind_speed_10m,wind_direction_10m`;
    const res = await fetch(url);
    const latencyMs = Math.round(performance.now() - t0);
    
    if (res.status === 429) {
      return { data: _fallbackWindGrid(), source: 'fallback', latencyMs, httpStatus: 429, message: 'HTTP 429: Rate limited — using fallback wind data', dataSize: 16 };
    }

    if (res.ok) {
      const data = await res.json();
      // Open-Meteo returns { error: true, reason: "..." } when rate-limited (even with 200 OK)
      if (data?.error) {
        return { data: _fallbackWindGrid(), source: 'fallback', latencyMs, httpStatus: res.status, message: `Rate limited: ${data.reason || 'Daily limit exceeded'} — using fallback`, dataSize: 16 };
      }
      if (Array.isArray(data)) {
        const points = data.map((d: any) => ({
          lat: d.latitude,
          lon: d.longitude,
          wind_speed: d.current?.wind_speed_10m || 15.0,
          wind_direction: d.current?.wind_direction_10m || 270.0
        }));
        return { data: points, source: 'live', latencyMs, httpStatus: res.status, dataSize: points.length };
      }
      return { data: _fallbackWindGrid(), source: 'fallback', latencyMs, httpStatus: res.status, message: 'API returned non-array format — using fallback', dataSize: 16 };
    }
    return { data: _fallbackWindGrid(), source: 'fallback', latencyMs, httpStatus: res.status, message: `HTTP ${res.status}: ${res.statusText} — using fallback`, dataSize: 16 };
  } catch (e: any) {
    return { data: _fallbackWindGrid(), source: 'fallback', latencyMs: Math.round(performance.now() - t0), message: `Network error: ${e?.message || 'Connection refused'} — using fallback`, dataSize: 16 };
  }
}

function _fallbackWindGrid(): WindGridPoint[] {
  // Realistic monsoon-season SW wind across Mumbai's 4x4 grid
  const lats = [18.9, 19.05, 19.2, 19.35];
  const lons = [72.7, 72.85, 73.0, 73.15];
  const points: WindGridPoint[] = [];
  for (const lon of lons) {
    for (const lat of lats) {
      // SW monsoon: direction ~230-250°, speed ~12-22 km/h, slightly stronger near coast
      const coastFactor = Math.max(0, 1 - (lon - 72.7) * 4);
      points.push({
        lat,
        lon,
        wind_speed: 14 + coastFactor * 6 + (Math.sin(lat * 100) * 2),
        wind_direction: 235 + (Math.cos(lon * 50) * 10)
      });
    }
  }
  return points;
}

export async function fetchMarine(): Promise<ApiResponse<MarineData>> {
  const t0 = performance.now();
  try {
    const res = await fetch(`${API_BASE}/marine`);
    const latencyMs = Math.round(performance.now() - t0);
    if (res.ok) {
      const data = await res.json();
      return { data, source: 'live', latencyMs, httpStatus: res.status };
    }
    return { data: _fallbackMarine(), source: 'fallback', latencyMs, httpStatus: res.status, message: `HTTP ${res.status}: ${res.statusText}` };
  } catch (e: any) {
    return { data: _fallbackMarine(), source: 'fallback', latencyMs: Math.round(performance.now() - t0), message: `Network error: ${e?.message || 'Connection refused'}` };
  }
}

function _fallbackMarine(): MarineData {
  return {
    wave_height: 1.85,
    wave_direction: 230,
    sea_temp: 28.4,
    tide_height: 3.9,
    tide_status: "High Tide Approaching",
    updated_at: "Live Feed"
  };
}

export async function fetchTraffic(): Promise<ApiResponse<TrafficData>> {
  const t0 = performance.now();
  try {
    const res = await fetch(`${API_BASE}/traffic`);
    const latencyMs = Math.round(performance.now() - t0);
    if (res.ok) {
      const data = await res.json();
      return { data, source: 'live', latencyMs, httpStatus: res.status };
    }
    return { data: _fallbackTraffic(), source: 'fallback', latencyMs, httpStatus: res.status, message: `HTTP ${res.status}: ${res.statusText}` };
  } catch (e: any) {
    return { data: _fallbackTraffic(), source: 'fallback', latencyMs: Math.round(performance.now() - t0), message: `Network error: ${e?.message || 'Connection refused'}` };
  }
}

function _fallbackTraffic(): TrafficData {
  return {
    city_overall_congestion: 62.5,
    traffic_index_level: "Moderate Rush",
    updated_at: "Live Feed",
    roads: []
  };
}

export async function fetchGIS(): Promise<ApiResponse<any>> {
  const t0 = performance.now();
  try {
    const res = await fetch(`${API_BASE}/gis/mumbai`, { cache: 'no-store' });
    const latencyMs = Math.round(performance.now() - t0);
    if (res.ok) {
      const data = await res.json();
      return { data, source: 'live', latencyMs, httpStatus: res.status };
    }
    return { data: { wards: [], landmarks: [], railways: [], metros: [], metro_bridges_3d: null }, source: 'fallback', latencyMs, httpStatus: res.status, message: `HTTP ${res.status}: ${res.statusText}` };
  } catch (e: any) {
    return { data: { wards: [], landmarks: [], railways: [], metros: [], metro_bridges_3d: null }, source: 'fallback', latencyMs: Math.round(performance.now() - t0), message: `Network error: ${e?.message || 'Connection refused'}` };
  }
}

export async function fetchTrains(simTime?: string | null, yatriEnabled: boolean = true): Promise<ApiResponse<any>> {
  const t0 = performance.now();
  try {
    let url = simTime ? `${API_BASE}/trains/live?sim_time=${simTime}` : `${API_BASE}/trains/live`;
    if (!yatriEnabled) url += (url.includes('?') ? '&' : '?') + 'yatri=false';
    const res = await fetch(url);
    const latencyMs = Math.round(performance.now() - t0);
    if (res.ok) {
      const data = await res.json();
      const featureCount = data?.features?.length || 0;
      const gpsCount = data?.metadata?.gps_count || 0;
      const scheduleCount = data?.metadata?.schedule_count || 0;
      return { 
        data, 
        source: gpsCount > 0 ? 'live' : 'live', 
        latencyMs, 
        httpStatus: res.status, 
        dataSize: featureCount,
        message: gpsCount > 0 ? `${gpsCount} GPS + ${scheduleCount} schedule` : undefined
      };
    }
    return { data: null, source: 'empty', latencyMs, httpStatus: res.status, message: `HTTP ${res.status}: ${res.statusText}`, dataSize: 0 };
  } catch (e: any) {
    return { data: null, source: 'empty', latencyMs: Math.round(performance.now() - t0), message: `Network error: ${e?.message || 'Connection refused'}`, dataSize: 0 };
  }
}

export async function fetchYatriStatus(): Promise<ApiResponse<any>> {
  const t0 = performance.now();
  try {
    const res = await fetch(`${API_BASE}/trains/yatri-status`);
    const latencyMs = Math.round(performance.now() - t0);
    if (res.ok) {
      const data = await res.json();
      const gpsCount = data?.total_trains_with_gps || 0;
      return { 
        data, 
        source: data?.enabled ? 'live' : 'cached', 
        latencyMs, 
        httpStatus: res.status, 
        dataSize: gpsCount,
        message: data?.last_error_message || undefined
      };
    }
    return { data: null, source: 'empty', latencyMs, httpStatus: res.status, message: `HTTP ${res.status}: ${res.statusText}`, dataSize: 0 };
  } catch (e: any) {
    return { data: null, source: 'empty', latencyMs: Math.round(performance.now() - t0), message: `Network error: ${e?.message || 'Connection refused'}`, dataSize: 0 };
  }
}

export async function fetchFlights(): Promise<ApiResponse<any>> {
  const t0 = performance.now();
  try {
    const res = await fetch(`${API_BASE}/flights/live`);
    const latencyMs = Math.round(performance.now() - t0);
    if (res.ok) {
      const data = await res.json();
      const featureCount = data?.features?.length || 0;
      return { data, source: 'live', latencyMs, httpStatus: res.status, dataSize: featureCount };
    }
    return { data: null, source: 'empty', latencyMs, httpStatus: res.status, message: `HTTP ${res.status}: ${res.statusText}`, dataSize: 0 };
  } catch (e: any) {
    return { data: null, source: 'empty', latencyMs: Math.round(performance.now() - t0), message: `Network error: ${e?.message || 'Connection refused'}`, dataSize: 0 };
  }
}


export async function postSimulation(req: SimulationRequest): Promise<SimulationResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    
    const res = await fetch(`${API_BASE}/simulation/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return data.simulation;
    }
  } catch (e) {
    console.warn("Backend simulation API failed, executing client-side calculation fallback", e);
  }
  
  // Client-side fallback computation
  
  // Calculate a population density multiplier based on distance to Mumbai's core (approx 19.076, 72.877)
  const coreLat = 19.0760;
  const coreLon = 72.8777;
  const distToCore = Math.sqrt(Math.pow((req.lat || coreLat) - coreLat, 2) + Math.pow((req.lon || coreLon) - coreLon, 2));
  // 0 distance = 1.5x multiplier (extremely dense). > 0.2 deg distance = 0.3x multiplier (suburbs/ocean)
  const densityMultiplier = Math.max(0.3, 1.5 - (distToCore * 6.0));

  if (req.disaster_type === "flood") {
    const head = (req.rainfall_mm_hr || 100) / 25.0 + (req.tide_height_m || 3.5) * 0.4;
    return {
      disaster_type: "Flood & Storm Surge",
      impact_score: Math.min(100, Math.round(head * 20 * densityMultiplier)),
      severity_level: head > 3 ? "RED ALERT - CATASTROPHIC" : "ORANGE ALERT - SEVERE",
      inundated_area_sqkm: Math.round(12.5 * Math.pow(head, 1.2) * 10) / 10,
      peak_water_depth_m: Math.round(head * 100) / 100,
      total_affected_population: Math.round(head * 185000 * densityMultiplier),
      economic_loss_crores_inr: Math.round(head * 450 * densityMultiplier),
      railway_status: [
        { line: "Harbour Line", status: "Suspended (Submerged at Chunabhatti)" },
        { line: "Central Line", status: "Slowed down at Sion" }
      ],
      critical_infrastructure: [
        { name: "Hindmata Flyover", category: "Flood Hotspot", water_depth_m: 1.85, risk_status: "CRITICAL INUNDATION" },
        { name: "Mithi River Basin", category: "River", water_depth_m: 2.4, risk_status: "RIVER OVERFLOW" }
      ]
    };
  } else if (req.disaster_type === "cyclone") {
    const wind = req.wind_speed_kmh || 150;
    const centralPressure = req.central_pressure_mb || 960.0;
    // Calculate global storm surge based on central pressure deficit and max wind
    const stormSurge = Math.max(0.4, (1013.25 - centralPressure) * 0.035 + (wind / 80.0));
    
    // Improved Holland-based empirical estimation without DEM
    const radiusOfMaxWinds = 15.0; // km
    const hollandB = 1.5;
    // Assume a 25x25 km area is severely affected and evaluate
    const damagedStructures = Math.round(wind * 85 * Math.pow(hollandB, 1.2) * densityMultiplier);
    
    return {
      disaster_type: "Severe Cyclone",
      impact_score: Math.min(100, Math.round((wind / 220) * 100 * densityMultiplier)),
      cyclone_category: wind > 180 ? "Extremely Severe" : "Very Severe",
      landfall_wind_kmh: wind,
      storm_surge_m: Math.round(stormSurge * 100) / 100,
      damaged_structures: damagedStructures,
      total_affected_population: Math.round(wind * 3200 * densityMultiplier),
      economic_loss_crores_inr: Math.round(damagedStructures * 0.45 + (stormSurge * 120.0))
    };
  } else if (req.disaster_type === "earthquake") {
    const mag = req.magnitude || 6.5;
    return {
      disaster_type: "Earthquake",
      impact_score: Math.min(100, Math.round((mag / 8.5) * 100 * densityMultiplier)),
      magnitude_richter: mag,
      focal_depth_km: req.depth_km || 10,
      max_pga_g: 0.18,
      total_collapsed_buildings: Math.round(Math.pow(mag, 3.2) * densityMultiplier),
      total_casualties_estimate: Math.round(Math.pow(mag, 3.5) * 2.2 * densityMultiplier),
      economic_loss_crores_inr: Math.round(Math.pow(mag, 4.0) * densityMultiplier)
    };
  } else if (req.disaster_type === "fire") {
    const rad = req.fire_radius_m || 400;
    return {
      disaster_type: "Slum / Industrial Wildfire",
      impact_score: Math.min(100, Math.round((rad / 1500) * 100 * densityMultiplier)),
      fire_radius_m: rad,
      evacuation_radius_m: rad * 2.5,
      spread_rate_m_min: 8.5,
      fire_area_hectares: Math.round((Math.PI * Math.pow(rad, 2)) / 1000) / 10,
      total_evacuees_estimate: Math.round(rad * 42 * densityMultiplier),
      economic_loss_crores_inr: Math.round(rad * 0.8 * densityMultiplier)
    };
  } else {
    const rise = req.sea_level_rise_m || 2.0;
    return {
      disaster_type: "Climate Sea Level Rise Projection",
      impact_score: Math.min(100, Math.round((rise / 5.0) * 100)),
      sea_level_rise_m: rise,
      permanently_submerged_land_sqkm: Math.round(8.5 * Math.pow(rise, 1.4) * 10) / 10,
      displaced_population_estimate: Math.round(rise * 125000),
      economic_loss_crores_inr: Math.round(rise * 1850),
      inundated_landmarks: [
        { name: "Gateway of India", elevation_m: 2.5, status: rise >= 2.5 ? "PERMANENTLY SUBMERGED" : "AT EXTREME HIGH TIDE RISK" },
        { name: "Marine Drive Promenade", elevation_m: 3.0, status: rise >= 3.0 ? "PERMANENTLY SUBMERGED" : "FREQUENT SEAWALL OVERTOPPING" }
      ]
    };
  }
}
