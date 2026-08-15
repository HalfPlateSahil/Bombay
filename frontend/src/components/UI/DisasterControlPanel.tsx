"use client";

import React, { useState } from "react";
import { ShieldAlert, Play, RotateCcw, MapPin, Zap, Flame, CloudLightning, Waves, Activity } from "lucide-react";
import { MUMBAI_LANDMARKS } from "../../services/api";

interface DisasterControlPanelProps {
  onRunSimulation: (disasterType: string, epicenter: any, params: any) => void;
  onResetSimulation: () => void;
  currentEpicenter: { name: string; lat: number; lon: number } | null;
  isSimulating: boolean;
  onLiveParamUpdate?: (disasterType: string, params: any) => void;
}

export const DisasterControlPanel: React.FC<DisasterControlPanelProps> = ({
  onRunSimulation,
  onResetSimulation,
  currentEpicenter,
  isSimulating,
  onLiveParamUpdate
}) => {
  const [selectedDisaster, setSelectedDisaster] = useState<string>("flood");

  // Physics Sliders State
  const [rainfallMm, setRainfallMm] = useState<number>(120);
  const [tideHeightM, setTideHeightM] = useState<number>(4.2);
  const [windSpeedKmh, setWindSpeedKmh] = useState<number>(165);
  const [magnitude, setMagnitude] = useState<number>(6.8);
  const [fireRadiusM, setFireRadiusM] = useState<number>(450);
  const [seaLevelRiseM, setSeaLevelRiseM] = useState<number>(2.0);

  const epicenter = currentEpicenter || {
    name: "Hindmata / Dadar (Default)",
    lat: 19.0125,
    lon: 72.8445
  };

  const handleRun = () => {
    let params: any = {};
    if (selectedDisaster === "flood") {
      params = { rainfall_mm_hr: rainfallMm, tide_height_m: tideHeightM, surge_m: 0.8 };
    } else if (selectedDisaster === "cyclone") {
      params = { wind_speed_kmh: windSpeedKmh, central_pressure_mb: 955.0 };
    } else if (selectedDisaster === "earthquake") {
      params = { magnitude: magnitude, depth_km: 10.0 };
    } else if (selectedDisaster === "fire") {
      params = { fire_radius_m: fireRadiusM, wind_speed_kmh: 25.0, wind_direction_deg: 240.0 };
    } else if (selectedDisaster === "climate") {
      params = { sea_level_rise_m: seaLevelRiseM };
    }

    onRunSimulation(selectedDisaster, epicenter, params);
  };

  return (
    <div className="absolute bottom-6 left-6 z-20 w-[calc(50%-1.5rem)] max-w-[800px] bg-black/40 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-2xl shadow-black/50 pointer-events-auto flex gap-6">
      
      {/* Left Column: Info & Actions */}
      <div className="flex flex-col justify-between min-w-[220px]">
        <div>
          <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5 text-hazardRed animate-pulse" />
              <h2 className="text-[9px] font-medium text-white uppercase tracking-[0.2em]">
                Disaster Workbench
              </h2>
            </div>
            {isSimulating && (
              <span className="text-[7px] text-hazardRed uppercase tracking-widest bg-hazardRed/10 px-1.5 py-0.5 rounded-full border border-hazardRed/20">
                ACTIVE
              </span>
            )}
          </div>
          
          {/* Epicenter Target Indicator */}
          <div className="mb-4 bg-white/5 p-2.5 rounded-xl border border-white/5 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-cyan-400/90">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate max-w-[180px] text-[10px] font-light tracking-wide">{epicenter.name}</span>
            </div>
            <span className="text-[8px] text-white/40 font-mono tracking-widest pl-4">
              {epicenter.lat.toFixed(3)}°, {epicenter.lon.toFixed(3)}°
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleRun}
            className="flex-1 flex items-center justify-center gap-2 bg-hazardRed/80 hover:bg-hazardRed text-white py-2 rounded-xl text-[9px] uppercase tracking-[0.2em] font-medium transition-all duration-300 border border-hazardRed/50 hover:shadow-lg hover:shadow-hazardRed/20 hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <Play className="w-3 h-3 fill-white" />
            Run
          </button>
          <button
            onClick={onResetSimulation}
            className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl border border-white/5 transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.98]"
            title="Reset Simulation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Right Column: Controls & Sliders */}
      <div className="flex-1 flex flex-col">
        {/* Disaster Selector Tabs */}
        <div className="flex gap-1.5 mb-4 border-b border-white/5 pb-3">
          {[
            { id: "flood", label: "Flood", icon: Waves },
            { id: "cyclone", label: "Cyclone", icon: CloudLightning },
            { id: "earthquake", label: "Quake", icon: Zap },
            { id: "fire", label: "Fire", icon: Flame },
            { id: "climate", label: "2050 SLR", icon: Activity }
          ].map((item) => {
            const Icon = item.icon;
            const active = selectedDisaster === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSelectedDisaster(item.id)}
                className={`flex-1 flex flex-col items-center justify-center p-2 rounded-xl text-[8px] uppercase tracking-wider transition-all duration-300 ${
                  active
                    ? "bg-white/10 text-white border border-white/20 shadow-lg shadow-black/20"
                    : "text-white/40 hover:text-white hover:bg-white/5 border border-transparent"
                }`}
              >
                <Icon className="w-3 h-3 mb-1" />
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Physics Sliders */}
        <div className="flex-1 flex flex-col justify-center space-y-4 font-mono text-[10px]">
          {selectedDisaster === "flood" && (
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-white/60 mb-1.5 uppercase tracking-wider text-[9px]">
                  <span>Rain Rate</span>
                  <span className="text-cyan-400 font-medium">{rainfallMm} mm/h</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="250"
                  value={rainfallMm}
                  onChange={(e) => setRainfallMm(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer h-1 bg-white/10 rounded-lg appearance-none"
                />
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-white/60 mb-1.5 uppercase tracking-wider text-[9px]">
                  <span>Tide Surge</span>
                  <span className="text-cyan-400 font-medium">{tideHeightM} m</span>
                </div>
                <input
                  type="range"
                  min="1.5"
                  max="15.5"
                  step="0.1"
                  value={tideHeightM}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setTideHeightM(val);
                    if (onLiveParamUpdate) onLiveParamUpdate("flood", { tide_height_m: val });
                  }}
                  className="w-full accent-cyan-400 cursor-pointer h-1 bg-white/10 rounded-lg appearance-none"
                />
              </div>
            </div>
          )}

          {selectedDisaster === "cyclone" && (
            <div>
              <div className="flex justify-between text-white/60 mb-1.5 uppercase tracking-wider text-[9px]">
                <span>Landfall Wind Velocity</span>
                <span className="text-hazardRed font-medium">{windSpeedKmh} km/h</span>
              </div>
              <input
                type="range"
                min="80"
                max="260"
                value={windSpeedKmh}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setWindSpeedKmh(val);
                  if (onLiveParamUpdate) onLiveParamUpdate("cyclone", { wind_speed_kmh: val });
                }}
                className="w-full accent-hazardRed cursor-pointer h-1 bg-white/10 rounded-lg appearance-none"
              />
            </div>
          )}

          {selectedDisaster === "earthquake" && (
            <div>
              <div className="flex justify-between text-white/60 mb-1.5 uppercase tracking-wider text-[9px]">
                <span>Richter Magnitude</span>
                <span className="text-hazardRed font-medium">{magnitude} M_w</span>
              </div>
              <input
                type="range"
                min="4.5"
                max="8.5"
                step="0.1"
                value={magnitude}
                onChange={(e) => setMagnitude(Number(e.target.value))}
                className="w-full accent-hazardRed cursor-pointer h-1 bg-white/10 rounded-lg appearance-none"
              />
            </div>
          )}

          {selectedDisaster === "fire" && (
            <div>
              <div className="flex justify-between text-white/60 mb-1.5 uppercase tracking-wider text-[9px]">
                <span>Wildfire Radius</span>
                <span className="text-amber-500 font-medium">{fireRadiusM} m</span>
              </div>
              <input
                type="range"
                min="100"
                max="1200"
                step="50"
                value={fireRadiusM}
                onChange={(e) => setFireRadiusM(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer h-1 bg-white/10 rounded-lg appearance-none"
              />
            </div>
          )}

          {selectedDisaster === "climate" && (
            <div>
              <div className="flex justify-between text-white/60 mb-1.5 uppercase tracking-wider text-[9px]">
                <span>Sea Level Rise</span>
                <span className="text-cyan-400 font-medium">+{seaLevelRiseM} m</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="5.0"
                step="0.5"
                value={seaLevelRiseM}
                onChange={(e) => setSeaLevelRiseM(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer h-1 bg-white/10 rounded-lg appearance-none"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
