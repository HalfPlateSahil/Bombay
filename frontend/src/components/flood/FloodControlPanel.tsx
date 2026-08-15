import React, { useState } from "react";
import { ShieldAlert, Play, Pause, RotateCcw, MapPin, Waves, Settings2 } from "lucide-react";
import { SimulationParams } from "../../simulation/flood/FloodEngine";

interface FloodControlPanelProps {
  onStart: (params: SimulationParams) => void;
  onPause: () => void;
  onReset: () => void;
  currentEpicenter: { name: string; lat: number; lon: number } | null;
  isRunning: boolean;
}

export const FloodControlPanel: React.FC<FloodControlPanelProps> = ({
  onStart,
  onPause,
  onReset,
  currentEpicenter,
  isRunning
}) => {
  const [rainfallMmHr, setRainfallMmHr] = useState<number>(150);
  const [drainageEfficiencyPct, setDrainageEfficiencyPct] = useState<number>(60);
  const [seaLevelM, setSeaLevelM] = useState<number>(1.0);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(10);

  const epicenter = currentEpicenter || {
    name: "Mumbai (Default Area)",
    lat: 19.076,
    lon: 72.877
  };

  const handleStartPause = () => {
    if (isRunning) {
      onPause();
    } else {
      onStart({
        rainfallMmHr,
        drainageEfficiencyPct,
        seaLevelM,
        timeStepSeconds: 30 * speedMultiplier // Base 30s timestep * speed multiplier
      });
    }
  };

  return (
    <div className="absolute bottom-6 left-6 z-20 w-[calc(50%-1.5rem)] max-w-[800px] bg-black/50 backdrop-blur-2xl border border-blue-500/30 rounded-2xl p-4 shadow-2xl shadow-black/80 pointer-events-auto flex gap-6">
      
      {/* Left Column: Info & Actions */}
      <div className="flex flex-col justify-between min-w-[220px]">
        <div>
          <div className="flex items-center justify-between mb-3 border-b border-blue-500/20 pb-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
              <h2 className="text-[9px] font-medium text-white uppercase tracking-[0.2em]">
                Flood Simulator
              </h2>
            </div>
            {isRunning && (
              <span className="text-[7px] text-blue-400 uppercase tracking-widest bg-blue-500/20 px-1.5 py-0.5 rounded-full border border-blue-500/30">
                ACTIVE
              </span>
            )}
          </div>
          
          <div className="mb-4 bg-white/5 p-2.5 rounded-xl border border-white/5 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-blue-300">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate max-w-[180px] text-[10px] font-light tracking-wide">{epicenter.name}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleStartPause}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[9px] uppercase tracking-[0.2em] font-medium transition-all duration-300 border hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] ${
              isRunning 
                ? 'bg-amber-500/80 hover:bg-amber-500 text-white border-amber-500/50 hover:shadow-amber-500/20' 
                : 'bg-blue-600/80 hover:bg-blue-500 text-white border-blue-500/50 hover:shadow-blue-500/20'
            }`}
          >
            {isRunning ? (
              <><Pause className="w-3 h-3 fill-white" /> Pause</>
            ) : (
              <><Play className="w-3 h-3 fill-white" /> Start</>
            )}
          </button>
          <button
            onClick={onReset}
            className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl border border-white/5 transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.98]"
            title="Reset Simulation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Right Column: Physics Controls */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-3">
          <Waves className="w-4 h-4 text-blue-400" />
          <span className="text-[10px] uppercase tracking-widest text-white/80">Scenario Parameters</span>
        </div>

        <div className="flex-1 flex flex-col justify-center space-y-4 font-mono text-[10px]">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-white/60 mb-1.5 uppercase tracking-wider text-[9px]">
                <span>Rainfall Intensity</span>
                <span className="text-blue-400 font-medium">{rainfallMmHr} mm/hr</span>
              </div>
              <input
                type="range"
                min="0"
                max="350"
                step="10"
                value={rainfallMmHr}
                onChange={(e) => setRainfallMmHr(Number(e.target.value))}
                className="w-full accent-blue-400 cursor-pointer h-1 bg-white/10 rounded-lg appearance-none"
              />
            </div>
            <div className="flex-1">
              <div className="flex justify-between text-white/60 mb-1.5 uppercase tracking-wider text-[9px]">
                <span>Sea Level</span>
                <span className="text-blue-400 font-medium">+{seaLevelM.toFixed(1)} m</span>
              </div>
              <input
                type="range"
                min="0"
                max="3"
                step="0.1"
                value={seaLevelM}
                onChange={(e) => setSeaLevelM(Number(e.target.value))}
                className="w-full accent-blue-400 cursor-pointer h-1 bg-white/10 rounded-lg appearance-none"
              />
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-white/60 mb-1.5 uppercase tracking-wider text-[9px]">
                <span>Drainage Efficiency</span>
                <span className="text-green-400 font-medium">{drainageEfficiencyPct}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={drainageEfficiencyPct}
                onChange={(e) => setDrainageEfficiencyPct(Number(e.target.value))}
                className="w-full accent-green-400 cursor-pointer h-1 bg-white/10 rounded-lg appearance-none"
              />
            </div>
            <div className="flex-1">
              <div className="flex justify-between text-white/60 mb-1.5 uppercase tracking-wider text-[9px]">
                <span>Sim Speed</span>
                <span className="text-amber-400 font-medium">{speedMultiplier}x</span>
              </div>
              <input
                type="range"
                min="1"
                max="50"
                step="1"
                value={speedMultiplier}
                onChange={(e) => setSpeedMultiplier(Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer h-1 bg-white/10 rounded-lg appearance-none"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
