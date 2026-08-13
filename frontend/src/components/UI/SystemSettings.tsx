import React from 'react';
import { Settings2, XCircle, Power } from 'lucide-react';
import { ApiKey, ApiStatus } from '../../hooks/useTelemetryEngine';

interface SystemSettingsProps {
  statuses: Record<ApiKey, ApiStatus>;
  onToggle: (key: ApiKey) => void;
  onClose: () => void;
  simTime: string | null;
  onSimTimeChange: (time: string | null) => void;
}

export const SystemSettings: React.FC<SystemSettingsProps> = ({ statuses, onToggle, onClose, simTime, onSimTimeChange }) => {
  return (
    <div className="absolute bottom-20 right-6 w-80 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/5">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-white tracking-widest uppercase">System Settings</span>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors">
          <XCircle className="w-4 h-4" />
        </button>
      </div>
      
      <div className="p-4 flex flex-col gap-3">
        <div className="text-[9px] text-white/40 uppercase tracking-widest mb-1">
          Background Telemetry Services
        </div>
        
        {Object.entries(statuses).map(([key, data]) => (
          <div key={key} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors">
            <span className="text-xs text-white/80 capitalize">{key} API</span>
            <button
              onClick={() => onToggle(key as ApiKey)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                data.enabled ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                  data.enabled ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        ))}

        <div className="mt-2 pt-3 border-t border-white/5">
          <div className="text-[9px] text-white/40 uppercase tracking-widest mb-2">
            Simulation
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
            <span className="text-xs text-white/80">Simulate Time</span>
            <input 
              type="time" 
              className="bg-slate-800 text-white text-xs px-2 py-1 rounded border border-white/10 outline-none focus:border-emerald-500"
              value={simTime || ""}
              onChange={(e) => onSimTimeChange(e.target.value || null)}
            />
          </div>
          <p className="text-[10px] text-white/30 mt-1 px-1">Clear input to return to live real-time.</p>
        </div>
      </div>
    </div>
  );
};
