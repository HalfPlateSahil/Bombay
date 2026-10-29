export interface WeatherData {
  temperature: number;
  humidity: number;
  rainfall: number;
  wind_speed: number;
  wind_direction: number;
  cloud_cover: number;
  condition_text: string;
  updated_at: string;
  status: string;
}

export interface WindGridPoint {
  lat: number;
  lon: number;
  wind_speed: number;
  wind_direction: number;
}

export interface AQIStation {
  name: string;
  lat: number;
  lon: number;
  aqi: number;
  category: string;
  pm2_5?: number;
  pm10?: number;
}

export interface AQIData {
  overall_aqi: number;
  category: string;
  pm2_5: number;
  pm10: number;
  co: number;
  no2: number;
  so2: number;
  o3: number;
  updated_at: string;
  stations: AQIStation[];
}

export interface MarineData {
  wave_height: number;
  wave_direction: number;
  wave_period?: number;
  sea_temp: number;
  tide_height: number;
  tide_status: string;
  updated_at: string;
}

export interface TrafficRoad {
  id: string;
  name: string;
  congestion: number;
  current_speed_kmh: number;
  free_flow_speed_kmh: number;
  status: string;
  coordinates: [number, number][];
}

export interface TrafficData {
  city_overall_congestion: number;
  traffic_index_level: string;
  roads: TrafficRoad[];
  updated_at: string;
}

export interface WardInfo {
  code: string;
  name: string;
  lat: number;
  lon: number;
  area_sqkm: number;
  pop_density: number;
}

export interface LandmarkInfo {
  id: string;
  name: string;
  category: string;
  lat: number;
  lon: number;
  elevation_m: number;
}

export interface SimulationRequest {
  disaster_type: "flood" | "cyclone" | "earthquake" | "fire" | "climate";
  lat: number;
  lon: number;
  rainfall_mm_hr?: number;
  tide_height_m?: number;
  surge_m?: number;
  wind_speed_kmh?: number;
  central_pressure_mb?: number;
  magnitude?: number;
  depth_km?: number;
  fire_radius_m?: number;
  wind_direction_deg?: number;
  sea_level_rise_m?: number;
}

export interface SimulationResult {
  disaster_type: string;
  lat?: number;
  lon?: number;
  impact_score: number;
  severity_level?: string;
  inundated_area_sqkm?: number;
  peak_water_depth_m?: number;
  total_affected_population?: number;
  economic_loss_crores_inr?: number;
  affected_wards?: any[];
  railway_status?: any[];
  critical_infrastructure?: any[];
  cyclone_category?: string;
  landfall_wind_kmh?: number;
  storm_surge_m?: number;
  damaged_structures?: number;
  magnitude_richter?: number;
  focal_depth_km?: number;
  max_pga_g?: number;
  total_collapsed_buildings?: number;
  total_casualties_estimate?: number;
  fire_radius_m?: number;
  evacuation_radius_m?: number;
  spread_rate_m_min?: number;
  fire_area_hectares?: number;
  total_evacuees_estimate?: number;
  sea_level_rise_m?: number;
  permanently_submerged_land_sqkm?: number;
  displaced_population_estimate?: number;
  inundated_landmarks?: any[];
  impact_zones_geojson?: any;
}
