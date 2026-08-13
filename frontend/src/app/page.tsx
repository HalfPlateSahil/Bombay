"use client";

import React, { useState, useEffect } from "react";
import { Activity } from "lucide-react";
import { Header } from "../components/UI/Header";
import { TelemetryCards } from "../components/UI/TelemetryCards";
import { LayerControl } from "../components/UI/LayerControl";
import { DisasterControlPanel } from "../components/UI/DisasterControlPanel";
import { ImpactDashboard } from "../components/UI/ImpactDashboard";
import { MapLibreMumbaiMap, MapStyleType } from "../components/Map/MapLibreMumbaiMap";
import { WeatherCanvas } from "../components/Map/WeatherCanvas";
import { WeatherData, AQIData, MarineData, TrafficData, SimulationResult, WindGridPoint } from "../types";
import { postSimulation } from "../services/api";
import { useTelemetryEngine } from "../hooks/useTelemetryEngine";
import { SystemConsole } from "../components/UI/SystemConsole";
import { SystemSettings } from "../components/UI/SystemSettings";
import { Settings2, Terminal } from "lucide-react";

export default function Home() {
  // App Mode & Map Style state
  const [mode, setMode] = useState<"live" | "disaster">("live");
  const [mapStyle, setMapStyle] = useState<MapStyleType>("liberty");

  // Simulation Time override
  const [simTime, setSimTime] = useState<string | null>(null);
  const [simStartTime, setSimStartTime] = useState<number | null>(null);

  const handleSimTimeChange = (time: string | null) => {
    setSimTime(time);
    setSimStartTime(time ? Date.now() : null);
  };

  // Telemetric state managed by custom engine
  const { data: tData, statuses, toggleApi } = useTelemetryEngine(simTime, simStartTime);
  const { weather, aqi, marine, traffic, gis: gisData, wind: windGrid } = tData;

  // System UI state
  const [showConsole, setShowConsole] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // MapLibre Instance for 3D synchronization
  const [mapInstance, setMapInstance] = useState<any>(null);

  // Map layer toggle state
  const [layers, setLayers] = useState<Record<string, boolean>>({
    buildings: true,
    traffic: false,
    railways: false,
    weather: false,
    wind: false,
    aqi: false,
    marine: false,
    labels: false
  });

  // Selected Location for camera flyTo and disaster epicenter picking
  const [selectedLocation, setSelectedLocation] = useState<{ name: string; lat: number; lon: number } | null>({
    name: "Hindmata / Dadar (Central Flood Hotspot)",
    lat: 19.0125,
    lon: 72.8445
  });

  // Disaster Simulation State
  const [activeDisaster, setActiveDisaster] = useState<string | null>(null);
  const [simulationParams, setSimulationParams] = useState<any>(null);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [activeRightPanel, setActiveRightPanel] = useState<'layers' | 'analytics' | null>(null);

  // Fetch live telemetric data managed entirely by useTelemetryEngine hook now

  const handleToggleLayer = (layerKey: string) => {
    setLayers((prev) => ({ ...prev, [layerKey]: !prev[layerKey] }));
  };

  const handleMapClick = (lat: number, lon: number) => {
    setSelectedLocation({
      name: `Picked Location (${lat.toFixed(3)}°, ${lon.toFixed(3)}°)`,
      lat,
      lon
    });
  };

  const handleRunSimulation = async (
    disasterType: string,
    epicenter: { name: string; lat: number; lon: number },
    params: any
  ) => {
    setIsSimulating(true);
    setActiveDisaster(disasterType);
    setSimulationParams(params);
    setActiveRightPanel('analytics');

    const reqPayload = {
      disaster_type: disasterType as any,
      lat: epicenter.lat,
      lon: epicenter.lon,
      ...params
    };

    const result = await postSimulation(reqPayload);
    
    // Inject epicenter into result for 3D mapping
    const finalResult = {
      ...result,
      lat: epicenter.lat,
      lon: epicenter.lon
    };

    setSimulationResult(finalResult);
    setIsSimulating(false);
  };

  const handleResetSimulation = () => {
    setActiveDisaster(null);
    setSimulationParams(null);
    setSimulationResult(null);
    setIsSimulating(false);
    setActiveRightPanel(null);
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-900 select-none">
      {/* Top Header */}
      <Header
        mode={mode}
        onToggleMode={setMode}
        onSelectLocation={setSelectedLocation}
      />

      {/* Live Telemetry Cards */}
      <TelemetryCards
        weather={weather}
        aqi={aqi}
        marine={marine}
        traffic={traffic}
      />

      {/* Top Right Controls Wrapper */}
      <div className="absolute top-20 right-5 z-20 pointer-events-none flex items-start gap-2">
        
        {/* Analysis Button & Dropdown (Only in disaster mode when results exist) */}
        {mode === "disaster" && simulationResult && (
          <div className="relative pointer-events-auto">
            <button
              onClick={() => setActiveRightPanel(activeRightPanel === 'analytics' ? null : 'analytics')}
              className="flex items-center gap-3 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full px-4 py-1.5 shadow-2xl shadow-black/50 hover:bg-black/50 hover:border-white/20 transition-all duration-300 active:scale-[0.98]"
            >
              <Activity className="w-3.5 h-3.5 text-hazardRed animate-pulse" />
              <span className="text-[10px] font-medium text-white uppercase tracking-[0.15em]">Impact Analysis</span>
            </button>
            
            {activeRightPanel === 'analytics' && (
              <ImpactDashboard
                result={simulationResult}
                onClose={() => setActiveRightPanel(null)}
              />
            )}
          </div>
        )}

        {/* Layer & Map Style Control Panel */}
        <LayerControl
          layers={layers}
          mapStyle={mapStyle}
          statuses={statuses}
          onToggleLayer={handleToggleLayer}
          onSelectMapStyle={setMapStyle}
          isOpen={activeRightPanel === 'layers'}
          onToggle={() => setActiveRightPanel(activeRightPanel === 'layers' ? null : 'layers')}
        />
      </div>

      {/* Disaster Control Workbench (Shown in Disaster Mode) */}
      {mode === "disaster" && (
        <DisasterControlPanel
          onRunSimulation={handleRunSimulation}
          onResetSimulation={handleResetSimulation}
          currentEpicenter={selectedLocation}
          isSimulating={isSimulating}
          onLiveParamUpdate={(type, params) => {
            if (activeDisaster === type) {
              setSimulationParams((prev: any) => ({ ...prev, ...params }));
            }
          }}
        />
      )}

      {/* Animated Weather & Disaster Particle Canvas Overlay */}
      <WeatherCanvas
        weather={weather}
        aqi={aqi}
        marine={marine}
        layers={layers}
        activeDisaster={activeDisaster}
        simulationParams={simulationParams}
        simulationResult={simulationResult}
        mapInstance={mapInstance}
        selectedLocation={selectedLocation}
        windGrid={windGrid}
      />

      {/* Interactive 3D OpenFreeMap & Satellite Map View of Mumbai */}
      <MapLibreMumbaiMap
        layers={layers}
        traffic={traffic}
        aqi={aqi}
        gisData={gisData}
        trains={tData.trains}
        flights={tData.flights}
        mapStyle={mapStyle}
        selectedLocation={selectedLocation}
        activeDisaster={activeDisaster}
        simulationResult={simulationResult}
        onMapClick={handleMapClick}
        onMapLoad={setMapInstance}
      />

      {/* System Controls Bottom Right */}
      <div className="absolute bottom-6 right-6 z-[60] flex items-center gap-3">
        <button
          onClick={() => { setShowSettings(!showSettings); setShowConsole(false); }}
          className={`p-3 rounded-full backdrop-blur-md border transition-all ${showSettings ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-slate-800/80 border-white/10 text-white/60 hover:text-white/90'}`}
        >
          <Settings2 className="w-5 h-5" />
        </button>
        <button
          onClick={() => { setShowConsole(!showConsole); setShowSettings(false); }}
          className={`p-3 rounded-full backdrop-blur-md border transition-all ${showConsole ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' : 'bg-slate-800/80 border-white/10 text-white/60 hover:text-white/90'}`}
        >
          <Terminal className="w-5 h-5" />
        </button>
      </div>

      {showConsole && (
        <SystemConsole statuses={statuses} onClose={() => setShowConsole(false)} />
      )}

      {showSettings && (
        <SystemSettings 
          statuses={statuses} 
          onToggle={toggleApi} 
          onClose={() => setShowSettings(false)} 
          simTime={simTime}
          onSimTimeChange={handleSimTimeChange}
        />
      )}
    </main>
  );
}
