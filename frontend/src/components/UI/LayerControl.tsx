"use client";

import React, { useState } from "react";
import { Layers, Building2, Car, Train, CloudRain, Eye, Waves, MapPin, Sparkles, Map, Globe, Moon, Sun, Compass, Wind, Plane } from "lucide-react";
import { MapStyleType } from "../Map/MumbaiMap";

interface LayerControlProps {
  layers: Record<string, boolean>;
  mapStyle: MapStyleType;
  statuses: any;
  onToggleLayer: (layerKey: string) => void;
  onSelectMapStyle: (style: MapStyleType) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const LayerControl: React.FC<LayerControlProps> = ({
  layers,
  mapStyle,
  statuses,
  onToggleLayer,
  onSelectMapStyle,
  isOpen,
  onToggle
}) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const layerItems = [
    { key: "buildings", label: "3D Buildings", icon: Building2, color: "text-blue-500" },
    { key: "traffic", label: "Traffic Congestion", icon: Car, color: "text-amber-500" },
    { key: "railways", label: "Railway Network", icon: Train, color: "text-indigo-500" },
    { key: "weather", label: "Weather Particles", icon: CloudRain, color: "text-sky-500" },
    { key: "wind", label: "Wind Currents", icon: Wind, color: "text-cyan-400" },
    { key: "aqi", label: "AQI Heatmap", icon: Eye, color: "text-emerald-500" },
    { key: "marine", label: "Marine Waves", icon: Waves, color: "text-blue-600" },
    { key: "labels", label: "Ward Labels", icon: MapPin, color: "text-slate-600" },
    { key: "flights", label: "Air Traffic", icon: Plane, color: "text-amber-400" }
  ];

  const styleItems: { key: MapStyleType; label: string; icon: any }[] = [
    { key: "liberty", label: "Liberty", icon: Map },
    { key: "bright", label: "Bright", icon: Sun },
    { key: "dark", label: "Dark", icon: Moon },
    { key: "positron", label: "Positron", icon: Compass },
    { key: "satellite", label: "Satellite", icon: Globe }
  ];

  return (
    <div className="relative pointer-events-auto">
      {/* Toggle Drawer Button */}
      <button
        onClick={onToggle}
        className="flex items-center gap-3 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full pl-4 pr-1.5 py-1.5 shadow-2xl shadow-black/50 hover:bg-black/50 hover:border-white/20 transition-all duration-300 active:scale-[0.98]"
      >
        <Layers className="w-3.5 h-3.5 text-white/70" />
        <span className="text-[10px] font-medium text-white uppercase tracking-[0.15em]">Map Layers</span>
        <span className="ml-1 bg-white/10 text-white px-2.5 py-1 rounded-full text-[9px] font-mono tracking-widest border border-white/5">
          {Object.values(layers).filter(Boolean).length} Active
        </span>
      </button>

      {/* Layer & Basemap Switcher Drawer */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-72 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl p-5 shadow-2xl shadow-black/50 space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Basemap Style Selector — OpenFreeMap Styles */}
          <div>
            <span className="text-[9px] font-medium text-white/40 uppercase tracking-[0.2em] block mb-3">
              Map Styles
            </span>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-white/5 border border-white/5 rounded-xl">
              {styleItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    onClick={() => onSelectMapStyle(item.key)}
                    className={`flex flex-col items-center py-2 rounded-lg text-[9px] uppercase tracking-wider font-medium transition-all duration-300 ${
                      mapStyle === item.key
                        ? "bg-white/10 text-white shadow-lg border border-white/10"
                        : "text-white/40 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 mb-1.5" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Layer Overlays */}
          <div>
            <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
              <span className="text-[9px] font-medium text-white/40 uppercase tracking-[0.2em]">
                Feature Overlays
              </span>
              <Sparkles className="w-3 h-3 text-white/30" />
            </div>

            <div className="space-y-1">
              {layerItems.map((item) => {
                const Icon = item.icon;
                const active = layers[item.key] ?? false;
                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      const apiMap: Record<string, string> = {
                        traffic: 'traffic', weather: 'weather', wind: 'wind', 
                        aqi: 'aqi', marine: 'marine', flights: 'flights'
                      };
                      const api = apiMap[item.key];
                      if (api && statuses[api] && !statuses[api].enabled) {
                        setErrorMsg(`Cannot enable: ${item.label} API is OFF`);
                        setTimeout(() => setErrorMsg(null), 3000);
                        return;
                      }
                      onToggleLayer(item.key);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[11px] font-light tracking-wide transition-all duration-200 ${
                      active
                        ? "bg-white/5 text-white border border-white/10"
                        : "text-white/50 hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-3.5 h-3.5 ${active ? "text-white/90" : "text-white/30"}`} />
                      <span>{item.label}</span>
                    </div>
                    {/* Ultra minimal iOS-style toggle */}
                    <div
                      className={`w-7 h-3.5 rounded-full p-0.5 transition-colors duration-300 ${
                        active ? "bg-white/30" : "bg-white/10"
                      }`}
                    >
                      <div
                        className={`w-2.5 h-2.5 rounded-full bg-white transition-transform duration-300 shadow-sm ${
                          active ? "translate-x-3.5" : "translate-x-0"
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
            
            {/* Error Message Toast */}
            {errorMsg && (
              <div className="mt-3 bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] px-3 py-2 rounded-lg text-center tracking-wide animate-in fade-in slide-in-from-bottom-1">
                {errorMsg}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
