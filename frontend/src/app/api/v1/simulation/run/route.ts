import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MUMBAI_WARDS = [
  { code: "A", name: "Colaba / Fort / Churchgate", lat: 18.928, lon: 72.833, area_sqkm: 12.5, pop_density: 18500 },
  { code: "B", name: "Sandhurst Road / Dongri", lat: 18.956, lon: 72.837, area_sqkm: 2.5, pop_density: 62000 },
  { code: "C", name: "Marine Lines / Chandanwadi", lat: 18.948, lon: 72.825, area_sqkm: 1.8, pop_density: 95000 },
  { code: "D", name: "Malabar Hill / Grant Road", lat: 18.962, lon: 72.812, area_sqkm: 7.6, pop_density: 48000 },
  { code: "E", name: "Byculla / Mazgaon", lat: 18.975, lon: 72.833, area_sqkm: 7.4, pop_density: 58000 },
  { code: "F/S", name: "Parel / Sewri", lat: 18.995, lon: 72.842, area_sqkm: 14.0, pop_density: 28000 },
  { code: "F/N", name: "Matunga / Wadala", lat: 19.023, lon: 72.856, area_sqkm: 13.1, pop_density: 41000 },
  { code: "G/S", name: "Worli / Prabhadevi", lat: 19.012, lon: 72.821, area_sqkm: 10.0, pop_density: 37000 },
  { code: "G/N", name: "Dadar / Dharavi", lat: 19.038, lon: 72.848, area_sqkm: 9.1, pop_density: 115000 },
  { code: "H/E", name: "Bandra East / BKC", lat: 19.062, lon: 72.852, area_sqkm: 13.5, pop_density: 42000 },
  { code: "H/W", name: "Bandra West / Khar / Santacruz", lat: 19.058, lon: 72.830, area_sqkm: 11.5, pop_density: 31000 },
  { code: "K/E", name: "Andheri East / Marol", lat: 19.117, lon: 72.863, area_sqkm: 24.8, pop_density: 33000 },
  { code: "K/W", name: "Andheri West / Juhu / Versova", lat: 19.125, lon: 72.824, area_sqkm: 23.4, pop_density: 31000 },
  { code: "L", name: "Kurla / Chunabhatti / Sakinaka", lat: 19.073, lon: 72.885, area_sqkm: 15.9, pop_density: 58000 },
  { code: "M/E", name: "Govandi / Mankhurd / Chembur", lat: 19.052, lon: 72.915, area_sqkm: 32.5, pop_density: 25000 },
  { code: "M/W", name: "Chembur West / Tilak Nagar", lat: 19.068, lon: 72.898, area_sqkm: 19.5, pop_density: 21000 },
  { code: "N", name: "Ghatkopar / Vikhroli", lat: 19.086, lon: 72.908, area_sqkm: 26.0, pop_density: 24000 },
  { code: "S", name: "Bhandup / Kanjurmarg / Powai", lat: 19.135, lon: 72.925, area_sqkm: 64.0, pop_density: 12000 },
  { code: "T", name: "Mulund / Nahur", lat: 19.172, lon: 72.956, area_sqkm: 45.4, pop_density: 9500 },
  { code: "R/S", name: "Kandivali East / Malad East", lat: 19.208, lon: 72.852, area_sqkm: 17.8, pop_density: 38000 },
  { code: "R/C", name: "Borivali / Dahisar", lat: 19.230, lon: 72.856, area_sqkm: 50.0, pop_density: 11000 }
];

const MUMBAI_LANDMARKS = [
  { id: "cst", name: "Chhatrapati Shivaji Maharaj Terminus (CSMT)", category: "Railway Station", lat: 18.9400, lon: 72.8353, elevation_m: 8.0 },
  { id: "gateway", name: "Gateway of India", category: "Landmark", lat: 18.9220, lon: 72.8347, elevation_m: 2.5 },
  { id: "bkc", name: "Bandra Kurla Complex (BKC)", category: "Business District", lat: 19.0657, lon: 72.8687, elevation_m: 4.2 },
  { id: "airport", name: "Chhatrapati Shivaji Maharaj Intl Airport (BOM)", category: "Airport", lat: 19.0896, lon: 72.8656, elevation_m: 11.0 },
  { id: "dharavi", name: "Dharavi Sector", category: "High Density Zone", lat: 19.0402, lon: 72.8508, elevation_m: 3.8 },
  { id: "mithi_river", name: "Mithi River Basin / Kurla", category: "River Basin", lat: 19.0700, lon: 72.8700, elevation_m: 2.1 },
  { id: "kem_hospital", name: "KEM Hospital Parel", category: "Hospital", lat: 19.0022, lon: 72.8420, elevation_m: 9.0 },
  { id: "lilavati_hospital", name: "Lilavati Hospital Bandra", category: "Hospital", lat: 19.0510, lon: 72.8285, elevation_m: 6.5 },
  { id: "hindmata", name: "Hindmata Flyover (Dadar Flood Hotspot)", category: "Flood Hotspot", lat: 19.0125, lon: 72.8445, elevation_m: 1.8 },
  { id: "milan_subway", name: "Milan Subway Santacruz", category: "Subway Hotspot", lat: 19.0870, lon: 72.8420, elevation_m: 1.2 },
  { id: "trombay_refinery", name: "Trombay / BPCL Industrial Zone", category: "Industrial Zone", lat: 19.0060, lon: 72.8950, elevation_m: 5.0 },
  { id: "powai_lake", name: "Powai Lake", category: "Water Body", lat: 19.1240, lon: 72.9050, elevation_m: 52.0 }
];

function runFlood(lat: number, lon: number, rain: number, tide: number, surge: number) {
  const totalWaterHead = rain / 25.0 + Math.max(0.0, tide - 2.8) + surge;
  const inundatedArea = Math.round(Math.min(180.0, 12.0 * Math.pow(totalWaterHead, 1.25)) * 100) / 100;

  const affectedWards: any[] = [];
  let totalAffectedPop = 0;

  for (const ward of MUMBAI_WARDS) {
    const dLat = (ward.lat - lat) * 111.0;
    const dLon = (ward.lon - lon) * 111.0 * Math.cos((lat * Math.PI) / 180);
    const distKm = Math.hypot(dLat, dLon);
    const baseElev = ward.code.includes("G") || ward.code.includes("L") || ward.code.includes("F") ? 4.0 : 12.0;
    const localDepth = Math.max(0.0, totalWaterHead * Math.exp(-distKm / 12.0) - baseElev / 6.0);

    if (localDepth > 0.15) {
      const pop = Math.round(ward.area_sqkm * ward.pop_density * Math.min(1.0, localDepth / 2.5));
      totalAffectedPop += pop;
      affectedWards.push({
        ward_code: ward.code,
        ward_name: ward.name,
        flood_depth_m: Math.round(localDepth * 100) / 100,
        affected_population: pop,
        severity: localDepth > 1.8 ? "Catastrophic" : (localDepth > 0.9 ? "Severe" : "Moderate")
      });
    }
  }

  const affectedRail: any[] = [];
  if (totalWaterHead > 1.5) {
    affectedRail.push({ line: "Harbour Line", status: "Suspended (Track Submerged at Chunabhatti & Kurla)" });
    affectedRail.push({ line: "Central Line", status: "Suspended (Submerged at Sion & Dadar)" });
  }
  if (totalWaterHead > 2.8) {
    affectedRail.push({ line: "Western Line", status: "Partially Suspended (Submerged at Milan Subway & Bandra)" });
  }

  const criticalInfra: any[] = [];
  for (const lm of MUMBAI_LANDMARKS) {
    const d = Math.hypot((lm.lat - lat) * 111.0, (lm.lon - lon) * 111.0);
    const waterDepth = Math.max(0.0, totalWaterHead * Math.exp(-d / 10.0) - lm.elevation_m / 5.0);
    if (waterDepth > 0.2) {
      criticalInfra.push({
        name: lm.name,
        category: lm.category,
        water_depth_m: Math.round(waterDepth * 100) / 100,
        risk_status: waterDepth > 1.2 ? "CRITICAL INUNDATION" : "MODERATE WATERLOGGING"
      });
    }
  }

  const economicLoss = Math.round((inundatedArea * 18.5 + (totalAffectedPop / 1000.0) * 4.2) * 10) / 10;

  return {
    disaster_type: "Flood & Storm Surge",
    inundated_area_sqkm: inundatedArea,
    peak_water_depth_m: Math.round(totalWaterHead * 100) / 100,
    total_affected_population: totalAffectedPop,
    economic_loss_crores_inr: economicLoss,
    affected_wards: affectedWards,
    railway_status: affectedRail,
    critical_infrastructure: criticalInfra,
    impact_score: Math.min(100, Math.round(totalWaterHead * 18)),
    severity_level: totalWaterHead > 3.0 ? "RED ALERT - CATASTROPHIC" : (totalWaterHead > 1.8 ? "ORANGE ALERT - SEVERE" : "YELLOW ALERT - MODERATE")
  };
}

function runCyclone(lat: number, lon: number, wind: number, pressure: number) {
  let catStr = "Category 1";
  if (wind >= 220) catStr = "Super Cyclone / Category 5";
  else if (wind >= 180) catStr = "Extremely Severe / Category 4";
  else if (wind >= 140) catStr = "Very Severe / Category 3";
  else if (wind >= 100) catStr = "Severe Cyclonic Storm / Category 1-2";

  const surge = Math.round(Math.max(0.4, (1013.25 - pressure) * 0.035 + wind / 80.0) * 100) / 100;

  const normalizedWind = Math.max(0, wind - 50) / 200.0;
  const scaleFactor = 0.1 + 0.9 * Math.pow(normalizedWind, 1.8);

  const greenRadius = 45.0 * scaleFactor;
  const orangeRadius = 20.0 * scaleFactor;
  const redRadius = 8.0 * scaleFactor;

  const affectedWards: any[] = [];
  let damagedBuildings = 0;
  let totalPop = 0;

  for (const ward of MUMBAI_WARDS) {
    const distKm = Math.hypot((ward.lat - lat) * 111.0, (ward.lon - lon) * 111.0);
    let overlap = 0;
    let bldgDamagePct = 0;
    let localWind = 0;

    if (distKm <= redRadius) {
      overlap = 1.0;
      bldgDamagePct = 0.8;
      localWind = wind;
    } else if (distKm <= orangeRadius) {
      overlap = 1.0;
      bldgDamagePct = 0.4;
      localWind = wind * 0.7;
    } else if (distKm <= greenRadius) {
      overlap = Math.max(0.1, 1.0 - (distKm - orangeRadius) / (greenRadius - orangeRadius));
      bldgDamagePct = 0.1;
      localWind = wind * 0.4;
    } else {
      continue;
    }

    const wardPop = Math.round(ward.area_sqkm * ward.pop_density * overlap);
    totalPop += wardPop;
    const bldgDamage = Math.round(ward.area_sqkm * 850 * bldgDamagePct * overlap);
    damagedBuildings += bldgDamage;

    affectedWards.push({
      ward_code: ward.code,
      ward_name: ward.name,
      wind_gust_kmh: Math.round(localWind * 10) / 10,
      damaged_structures: bldgDamage,
      power_grid_status: localWind > 110 ? "Blackout Risk" : "Voltage Fluctuation"
    });
  }

  const baseCost = damagedBuildings * 0.45;
  const economicLoss = Math.round(baseCost + surge * 120.0);

  return {
    disaster_type: "Severe Cyclone",
    cyclone_category: catStr,
    landfall_wind_kmh: wind,
    storm_surge_m: surge,
    damaged_structures: damagedBuildings,
    total_affected_population: totalPop,
    economic_loss_crores_inr: economicLoss,
    affected_wards: affectedWards,
    coastal_risk: surge > 3.0 ? "EXTREME COASTAL DESTRUCTION" : "MODERATE SURGE",
    impact_score: Math.min(100, Math.round((wind / 240.0) * 100)),
    inundated_area_sqkm: Math.round(Math.PI * Math.pow(greenRadius, 2) * 100) / 100
  };
}

function runEarthquake(lat: number, lon: number, mag: number, depth: number) {
  const pgaG = (0.08 * Math.exp(0.8 * mag)) / Math.pow(depth + 15.0, 1.1);

  const affectedWards: any[] = [];
  let collapsedBldgs = 0;
  let totalCasualties = 0;

  for (const ward of MUMBAI_WARDS) {
    const distKm = Math.hypot((ward.lat - lat) * 111.0, (ward.lon - lon) * 111.0);
    const hypoDist = Math.hypot(distKm, depth);
    const localPga = pgaG * Math.exp(-0.02 * hypoDist);
    const mmi = localPga > 0.001 ? Math.min(12.0, Math.max(1.0, 3.66 * Math.log10(localPga * 980) - 1.66)) : 1.0;

    if (mmi >= 5.0) {
      const structuralFailureRate = Math.max(0.0, (mmi - 5.0) / 7.0);
      const collapsed = Math.round(ward.area_sqkm * 420 * structuralFailureRate);
      const cas = Math.round(collapsed * 3.5);
      collapsedBldgs += collapsed;
      totalCasualties += cas;
      affectedWards.push({
        ward_code: ward.code,
        ward_name: ward.name,
        mmi_intensity: Math.round(mmi * 10) / 10,
        pga_g: Math.round(localPga * 1000) / 1000,
        collapsed_buildings: collapsed,
        casualty_estimate: cas
      });
    }
  }

  return {
    disaster_type: "Earthquake",
    magnitude_richter: mag,
    focal_depth_km: depth,
    max_pga_g: Math.round(pgaG * 1000) / 1000,
    total_collapsed_buildings: collapsedBldgs,
    total_casualties_estimate: totalCasualties,
    economic_loss_crores_inr: Math.round((collapsedBldgs * 2.8 + totalCasualties * 0.25) * 10) / 10,
    affected_wards: affectedWards,
    impact_score: Math.min(100, Math.round((mag / 8.5) * 100))
  };
}

function runFire(lat: number, lon: number, radius: number, wind: number, windDir: number) {
  const spreadRate = (wind / 10.0) * 3.5;
  const fireAreaSqm = Math.PI * Math.pow(radius, 2);
  const evacuationRadius = radius * 2.8 + spreadRate * 60.0;

  const affectedWards: any[] = [];
  let affectedPop = 0;

  for (const ward of MUMBAI_WARDS) {
    const distM = Math.hypot((ward.lat - lat) * 111000.0, (ward.lon - lon) * 111000.0);
    if (distM < evacuationRadius) {
      const pop = Math.round(ward.pop_density * (Math.PI * Math.pow(evacuationRadius / 1000.0, 2)));
      affectedPop += pop;
      affectedWards.push({
        ward_code: ward.code,
        ward_name: ward.name,
        distance_from_fire_m: Math.round(distM),
        hazard_level: distM < radius ? "DIRECT BURN ZONE" : "HEAVY SMOKE EVACUATION"
      });
    }
  }

  return {
    disaster_type: "Slum / Industrial Wildfire",
    fire_radius_m: radius,
    evacuation_radius_m: Math.round(evacuationRadius),
    spread_rate_m_min: Math.round(spreadRate * 10) / 10,
    fire_area_hectares: Math.round((fireAreaSqm / 10000.0) * 100) / 100,
    total_evacuees_estimate: affectedPop,
    economic_loss_crores_inr: Math.round((fireAreaSqm / 1000.0) * 1.5 * 10) / 10,
    affected_wards: affectedWards,
    impact_score: Math.min(100, Math.round((radius / 1500.0) * 100))
  };
}

function runClimate(rise: number) {
  const permanentlySubmerged = Math.round(8.5 * Math.pow(rise, 1.4) * 100) / 100;
  const displacedPop = Math.round(permanentlySubmerged * 24000);

  const inundatedLandmarks: any[] = [];
  for (const lm of MUMBAI_LANDMARKS) {
    if (lm.elevation_m <= rise) {
      inundatedLandmarks.push({
        name: lm.name,
        elevation_m: lm.elevation_m,
        status: "PERMANENTLY SUBMERGED BELOW SEA LEVEL"
      });
    }
  }

  return {
    disaster_type: "Climate Sea Level Rise Projection",
    sea_level_rise_m: rise,
    permanently_submerged_land_sqkm: permanentlySubmerged,
    displaced_population_estimate: displacedPop,
    inundated_landmarks: inundatedLandmarks,
    economic_loss_crores_inr: Math.round(permanentlySubmerged * 140.0 * 10) / 10,
    impact_score: Math.min(100, Math.round((rise / 5.0) * 100))
  };
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const disasterType = payload.disaster_type || "flood";
    const lat = parseFloat(payload.lat ?? 19.0125);
    const lon = parseFloat(payload.lon ?? 72.8445);

    let res: any;
    if (disasterType === "flood") {
      const rain = parseFloat(payload.rainfall_mm_hr ?? 120.0);
      const tide = parseFloat(payload.tide_height_m ?? 4.2);
      const surge = parseFloat(payload.surge_m ?? 0.8);
      res = runFlood(lat, lon, rain, tide, surge);
    } else if (disasterType === "cyclone") {
      const wind = parseFloat(payload.wind_speed_kmh ?? 165.0);
      const pressure = parseFloat(payload.central_pressure_mb ?? 955.0);
      res = runCyclone(lat, lon, wind, pressure);
    } else if (disasterType === "earthquake") {
      const mag = parseFloat(payload.magnitude ?? 6.8);
      const depth = parseFloat(payload.depth_km ?? 10.0);
      res = runEarthquake(lat, lon, mag, depth);
    } else if (disasterType === "fire") {
      const radius = parseFloat(payload.fire_radius_m ?? 450.0);
      const wind = parseFloat(payload.wind_speed_kmh ?? 25.0);
      const windDir = parseFloat(payload.wind_direction_deg ?? 240.0);
      res = runFire(lat, lon, radius, wind, windDir);
    } else if (disasterType === "climate") {
      const rise = parseFloat(payload.sea_level_rise_m ?? 2.0);
      res = runClimate(rise);
    } else {
      return NextResponse.json({ error: `Unknown disaster type: ${disasterType}` }, { status: 400 });
    }

    return NextResponse.json({
      status: "success",
      epicenter: { lat, lon },
      simulation: res
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal simulation error" }, { status: 500 });
  }
}

