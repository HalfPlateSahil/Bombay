"use client";

import React from "react";
import { CloudRain, Thermometer, Wind, Eye, Waves, Car, AlertTriangle } from "lucide-react";
import { WeatherData, AQIData, MarineData, TrafficData } from "../../types";

interface TelemetryCardsProps {
  weather: WeatherData | null;
  aqi: AQIData | null;
  marine: MarineData | null;
  traffic: TrafficData | null;
}

export const TelemetryCards: React.FC<TelemetryCardsProps> = ({
  weather,
  aqi,
  marine,
  traffic
}) => {
  return (
    <div className="absolute top-20 left-4 z-20 flex flex-col gap-3 max-w-xs w-full pointer-events-none">
      {/* 1. Live Weather Card */}
      <div className="pointer-events-auto bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl shadow-black/50 transition-all duration-300 hover:bg-black/50 hover:border-white/20">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-medium text-cyan-400/80 uppercase tracking-[0.2em] flex items-center gap-2">
            <CloudRain className="w-3.5 h-3.5 text-cyan-400/80" />
            Live Climate & Rain
          </span>
          <span className="text-[9px] text-white/40 uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
            {weather?.updated_at || "Live"}
          </span>
        </div>

        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-3xl font-light text-white tracking-tight">
              {weather?.temperature ?? 30.2}°C
            </span>
            <p className="text-[11px] text-white/50 font-light tracking-wide mt-1">{weather?.condition_text ?? "Monsoon Showers"}</p>
          </div>
          <div className="text-right font-mono text-[10px] space-y-1">
            <div className="text-white/40 uppercase tracking-wider">Rain: <span className="text-cyan-400/90 font-medium">{weather?.rainfall ?? 14.5} mm/h</span></div>
            <div className="text-white/40 uppercase tracking-wider">Wind: <span className="text-white/90 font-medium">{weather?.wind_speed ?? 19.5} km/h</span></div>
            <div className="text-white/40 uppercase tracking-wider">Humid: <span className="text-white/90 font-medium">{weather?.humidity ?? 76}%</span></div>
          </div>
        </div>
      </div>

      {/* 2. Air Quality Card */}
      <div className="pointer-events-auto bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl shadow-black/50 transition-all duration-300 hover:bg-black/50 hover:border-white/20">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-medium text-emerald-400/80 uppercase tracking-[0.2em] flex items-center gap-2">
            <Eye className="w-3.5 h-3.5 text-emerald-400/80" />
            Air Quality (AQI)
          </span>
          <span className="text-[9px] text-emerald-400/90 font-medium uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            {aqi?.category ?? "Moderate"}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-light text-white">{aqi?.overall_aqi ?? 95}</span>
            <span className="text-[10px] text-white/40 uppercase tracking-widest font-mono">US-AQI</span>
          </div>
          
          <div className="flex gap-3 font-mono text-[10px]">
            <div className="bg-white/5 px-2 py-1 rounded-md border border-white/5">
              <span className="text-white/40 uppercase tracking-wider">PM2.5:</span> <span className="text-emerald-400/90 font-medium">{aqi?.pm2_5 ?? 45}</span>
            </div>
            <div className="bg-white/5 px-2 py-1 rounded-md border border-white/5">
              <span className="text-white/40 uppercase tracking-wider">PM10:</span> <span className="text-emerald-400/90 font-medium">{aqi?.pm10 ?? 85}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Marine Card */}
      <div className="pointer-events-auto bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl shadow-black/50 transition-all duration-300 hover:bg-black/50 hover:border-white/20">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-medium text-blue-400/80 uppercase tracking-[0.2em] flex items-center gap-2">
            <Waves className="w-3.5 h-3.5 text-blue-400/80" />
            Arabian Sea Marine
          </span>
          <span className="text-[9px] text-white/50 uppercase tracking-wider font-medium bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
            {marine?.tide_status ?? "Low Tide"}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/5 rounded-xl p-2 border border-white/5 flex flex-col items-center">
            <span className="text-[9px] text-white/40 uppercase tracking-widest mb-1 font-mono">Tide</span>
            <span className="text-sm font-light text-cyan-400/90">{marine?.tide_height ?? 1.2}m</span>
          </div>
          <div className="bg-white/5 rounded-xl p-2 border border-white/5 flex flex-col items-center">
            <span className="text-[9px] text-white/40 uppercase tracking-widest mb-1 font-mono">Wave</span>
            <span className="text-sm font-light text-white/90">{marine?.wave_height ?? 2.1}m</span>
          </div>
          <div className="bg-white/5 rounded-xl p-2 border border-white/5 flex flex-col items-center">
            <span className="text-[9px] text-white/40 uppercase tracking-widest mb-1 font-mono">Sea Temp</span>
            <span className="text-sm font-light text-white/90">{marine?.sea_temp ?? 29.5}°C</span>
          </div>
        </div>
      </div>

      {/* 4. Traffic Card */}
      <div className="pointer-events-auto bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl shadow-black/50 transition-all duration-300 hover:bg-black/50 hover:border-white/20">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-medium text-amber-400/80 uppercase tracking-[0.2em] flex items-center gap-2">
            <Car className="w-3.5 h-3.5 text-amber-400/80" />
            Mumbai Highways Traffic
          </span>
          <span className="text-[9px] text-amber-400/90 uppercase tracking-wider font-medium bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
            {traffic?.traffic_index_level ?? "Moderate"}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-light text-white/60 tracking-wide">City Congestion Index</span>
          <span className="text-xl font-light text-amber-400/90">{traffic?.city_overall_congestion ?? 45.2}%</span>
        </div>
      </div>
    </div>
  );
};
