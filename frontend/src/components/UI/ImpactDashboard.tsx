"use client";

import React from "react";
import { AlertCircle, Train, Building, Users, DollarSign, Activity, FileText } from "lucide-react";
import { SimulationResult } from "../../types";

interface ImpactDashboardProps {
  result: SimulationResult | null;
  onClose: () => void;
}

export const ImpactDashboard: React.FC<ImpactDashboardProps> = ({ result, onClose }) => {
  if (!result) return null;

  const score = result.impact_score || 75;
  let scoreColor = "text-yellow-400 border-yellow-400/20 bg-yellow-400/5";
  if (score > 80) scoreColor = "text-hazardRed border-hazardRed/20 bg-hazardRed/5";
  else if (score < 40) scoreColor = "text-emerald-400 border-emerald-400/20 bg-emerald-400/5";

  return (
    <div className="absolute right-0 mt-3 w-80 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl p-5 shadow-2xl shadow-black/50 space-y-5 animate-in fade-in slide-in-from-top-2 duration-200 pointer-events-auto">
      {/* Header */}
      <div className="border-b border-white/5 pb-3">
        <h3 className="text-[10px] font-medium text-white uppercase tracking-[0.2em] flex items-center gap-2 mb-1">
          <Activity className="w-3.5 h-3.5 text-hazardRed animate-pulse" />
          Impact Analytics
        </h3>
        <p className="text-[8px] text-white/40 font-mono uppercase tracking-widest">{result.disaster_type}</p>
      </div>

      {/* Impact Severity Badge */}
      <div className={`p-4 rounded-xl border flex flex-col justify-center items-center gap-2 ${scoreColor}`}>
        <span className="text-[9px] text-white/50 uppercase tracking-[0.2em]">RISK LEVEL: {result.severity_level || "HIGH IMPACT"}</span>
        <span className="text-4xl font-light leading-none">{score}<span className="text-lg text-current/50">/100</span></span>
      </div>

      {/* Key Metric Counters Grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white/5 p-3 rounded-xl border border-white/5">
          <span className="text-[8px] text-white/40 uppercase tracking-[0.15em] flex items-center gap-1.5 mb-1.5">
            <Building className="w-3 h-3 text-cyan-400/80" />
            IMPACT AREA
          </span>
          <span className="text-[14px] font-light text-white tracking-wide">
            {result.inundated_area_sqkm ?? result.permanently_submerged_land_sqkm ?? 24.5} km²
          </span>
        </div>
        <div className="bg-white/5 p-3 rounded-xl border border-white/5">
          <span className="text-[8px] text-white/40 uppercase tracking-[0.15em] flex items-center gap-1.5 mb-1.5">
            <Users className="w-3 h-3 text-amber-400/80" />
            CITIZENS
          </span>
          <span className="text-[14px] font-light text-amber-400/90 tracking-wide">
            {((result.total_affected_population ?? result.displaced_population_estimate ?? 184000) / 1000).toFixed(1)}k
          </span>
        </div>
        <div className="bg-white/5 p-3 rounded-xl border border-white/5">
          <span className="text-[8px] text-white/40 uppercase tracking-[0.15em] flex items-center gap-1.5 mb-1.5">
            <DollarSign className="w-3 h-3 text-emerald-400/80" />
            DAMAGE
          </span>
          <span className="text-[14px] font-light text-emerald-400/90 tracking-wide">
            ₹{result.economic_loss_crores_inr ?? 840} Cr
          </span>
        </div>
        <div className="bg-white/5 p-3 rounded-xl border border-white/5">
          <span className="text-[8px] text-white/40 uppercase tracking-[0.15em] flex items-center gap-1.5 mb-1.5">
            <AlertCircle className="w-3 h-3 text-hazardRed/80" />
            MAX SURGE
          </span>
          <span className="text-[14px] font-light text-hazardRed/90 tracking-wide">
            {result.peak_water_depth_m ?? result.storm_surge_m ?? result.sea_level_rise_m ?? 2.8} m
          </span>
        </div>
      </div>

      {/* Condense lists into smaller scrolling container if present */}
      <div className="max-h-[160px] overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-white/10">
        {result.railway_status && result.railway_status.length > 0 && (
          <div className="space-y-2">
            <span className="text-[9px] font-medium text-white/60 uppercase tracking-[0.2em] flex items-center gap-1.5 sticky top-0 bg-black/60 backdrop-blur-md py-1 z-10">
              <Train className="w-3 h-3 text-white/50" />
              Railway Network
            </span>
            <div className="space-y-1.5">
              {result.railway_status.map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between border-b border-white/5 pb-1.5 last:border-0 last:pb-0">
                  <span className="font-light text-[10px] text-white/80 tracking-wide">{item.line}</span>
                  <span className="text-hazardRed/90 text-[9px] uppercase tracking-widest font-medium bg-hazardRed/10 px-1.5 py-0.5 rounded border border-hazardRed/20">{item.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.critical_infrastructure && result.critical_infrastructure.length > 0 && (
          <div className="space-y-2">
            <span className="text-[9px] font-medium text-white/60 uppercase tracking-[0.2em] flex items-center gap-1.5 sticky top-0 bg-black/60 backdrop-blur-md py-1 z-10">
              <Building className="w-3 h-3 text-white/50" />
              Critical Infra
            </span>
            <div className="space-y-1.5">
              {result.critical_infrastructure.map((infra: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between border-b border-white/5 pb-1.5 last:border-0 last:pb-0">
                  <div className="truncate max-w-[140px]">
                    <span className="font-light text-[10px] block text-white/80 tracking-wide truncate">{infra.name}</span>
                  </div>
                  <span className="text-hazardRed/90 font-medium text-[9px] uppercase tracking-widest bg-hazardRed/10 px-1.5 py-0.5 rounded border border-hazardRed/20">
                    {infra.risk_status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Export Button */}
      <button
        onClick={() => {
          const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `mumbai_simulation_${result.disaster_type}.json`;
          a.click();
        }}
        className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white py-2.5 rounded-xl border border-white/10 text-[9px] font-medium uppercase tracking-[0.2em] transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.98]"
      >
        <FileText className="w-3 h-3" />
        Export Report
      </button>
    </div>
  );
};
