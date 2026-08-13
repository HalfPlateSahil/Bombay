"use client";

import React, { useState } from 'react';
import { Terminal, Activity, CheckCircle2, XCircle, AlertCircle, Clock, ChevronDown, ChevronRight, Zap, Shield, ArrowDownCircle, TrendingUp, Database } from 'lucide-react';
import { ApiKey, ApiStatus, ApiCallRecord } from '../../hooks/useTelemetryEngine';

interface SystemConsoleProps {
  statuses: Record<ApiKey, ApiStatus>;
  onClose: () => void;
}

const API_LABELS: Record<ApiKey, string> = {
  weather: 'Weather',
  aqi: 'Air Quality',
  marine: 'Marine',
  traffic: 'Traffic',
  gis: 'GIS Data',
  wind: 'Wind Currents',
  trains: 'Train Tracker',
  flights: 'Flight Tracker',
  yatri: 'Yatri Live GPS',
};

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  live: { label: 'LIVE', color: 'text-emerald-400' },
  fallback: { label: 'FALLBACK', color: 'text-amber-400' },
  cached: { label: 'CACHED', color: 'text-blue-400' },
  empty: { label: 'NO DATA', color: 'text-red-400' },
};

export const SystemConsole: React.FC<SystemConsoleProps> = ({ statuses, onClose }) => {
  const [expandedApi, setExpandedApi] = useState<ApiKey | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OK': return 'text-emerald-400';
      case 'FETCHING': return 'text-cyan-400 animate-pulse';
      case 'RATE_LIMITED': return 'text-amber-400';
      case 'FALLBACK': return 'text-orange-400';
      case 'ERROR': return 'text-red-400';
      case 'OFF': return 'text-slate-500';
      default: return 'text-slate-400';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'OK': return 'bg-emerald-500/10 border-emerald-500/20';
      case 'FETCHING': return 'bg-cyan-500/10 border-cyan-500/20';
      case 'RATE_LIMITED': return 'bg-amber-500/10 border-amber-500/20';
      case 'FALLBACK': return 'bg-orange-500/10 border-orange-500/20';
      case 'ERROR': return 'bg-red-500/10 border-red-500/20';
      case 'OFF': return 'bg-slate-800/50 border-slate-700/30';
      default: return 'bg-slate-800/50 border-white/5';
    }
  };

  const getStatusIcon = (status: string, size = 'w-3.5 h-3.5') => {
    switch (status) {
      case 'OK': return <CheckCircle2 className={`${size} text-emerald-400`} />;
      case 'FETCHING': return <Activity className={`${size} text-cyan-400 animate-spin`} />;
      case 'RATE_LIMITED': return <AlertCircle className={`${size} text-amber-400`} />;
      case 'FALLBACK': return <Shield className={`${size} text-orange-400`} />;
      case 'ERROR': return <XCircle className={`${size} text-red-400`} />;
      case 'OFF': return <XCircle className={`${size} text-slate-500`} />;
      default: return <Activity className={`${size} text-slate-400`} />;
    }
  };

  const getCallRecordStatusColor = (record: ApiCallRecord) => {
    switch (record.status) {
      case 'OK': return 'border-l-emerald-500';
      case 'FALLBACK': return 'border-l-orange-400';
      case 'RATE_LIMITED': return 'border-l-amber-400';
      case 'ERROR': return 'border-l-red-500';
      default: return 'border-l-slate-500';
    }
  };

  // Aggregate stats
  const totalCalls = Object.values(statuses).reduce((s, v) => s + v.totalCalls, 0);
  const totalErrors = Object.values(statuses).reduce((s, v) => s + v.totalErrors, 0);
  const totalFallbacks = Object.values(statuses).reduce((s, v) => s + v.totalFallbacks, 0);
  const liveCount = Object.values(statuses).filter(v => v.status === 'OK' && v.enabled).length;
  const activeCount = Object.values(statuses).filter(v => v.enabled).length;

  return (
    <div className="absolute bottom-20 right-6 w-[420px] bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 font-mono" style={{ maxHeight: 'calc(100vh - 120px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-gradient-to-r from-cyan-900/20 to-transparent">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold text-white tracking-widest uppercase">System Console</span>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors">
          <XCircle className="w-4 h-4" />
        </button>
      </div>

      {/* Live Stats Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-black/20">
        <div className="flex items-center gap-4 text-[9px] text-white/50 uppercase tracking-wider">
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-emerald-400" />
            <span className="text-emerald-400 font-bold">{liveCount}</span>/{activeCount} Live
          </span>
          <span className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-cyan-400" />
            <span className="text-cyan-400 font-bold">{totalCalls}</span> Calls
          </span>
          {totalErrors > 0 && (
            <span className="flex items-center gap-1">
              <XCircle className="w-3 h-3 text-red-400" />
              <span className="text-red-400 font-bold">{totalErrors}</span> Errors
            </span>
          )}
          {totalFallbacks > 0 && (
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-orange-400" />
              <span className="text-orange-400 font-bold">{totalFallbacks}</span> Fallbacks
            </span>
          )}
        </div>
      </div>
      
      {/* API List */}
      <div className="flex flex-col overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
        {(Object.entries(statuses) as [ApiKey, ApiStatus][]).map(([key, apiStatus]) => {
          const isExpanded = expandedApi === key;
          
          return (
            <div key={key} className="border-b border-white/5 last:border-b-0">
              {/* Summary Row */}
              <button
                onClick={() => setExpandedApi(isExpanded ? null : key)}
                className={`w-full flex items-center justify-between px-4 py-2.5 transition-all hover:bg-white/5 ${isExpanded ? 'bg-white/5' : ''}`}
              >
                <div className="flex items-center gap-2.5">
                  {isExpanded ? <ChevronDown className="w-3 h-3 text-white/40" /> : <ChevronRight className="w-3 h-3 text-white/40" />}
                  <span className="text-[11px] text-white/80 font-medium">{API_LABELS[key]}</span>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* Source badge */}
                  {apiStatus.lastSource && apiStatus.status !== 'OFF' && apiStatus.status !== 'FETCHING' && (
                    <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${SOURCE_LABELS[apiStatus.lastSource]?.color || 'text-slate-400'} bg-white/5`}>
                      {SOURCE_LABELS[apiStatus.lastSource]?.label || apiStatus.lastSource}
                    </span>
                  )}
                  
                  {/* Latency */}
                  {apiStatus.lastLatencyMs !== undefined && apiStatus.status !== 'OFF' && (
                    <span className={`text-[9px] tabular-nums ${apiStatus.lastLatencyMs > 2000 ? 'text-red-400' : apiStatus.lastLatencyMs > 500 ? 'text-amber-400' : 'text-white/30'}`}>
                      {apiStatus.lastLatencyMs}ms
                    </span>
                  )}

                  {/* Status badge */}
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border ${getStatusBg(apiStatus.status)}`}>
                    {getStatusIcon(apiStatus.status, 'w-3 h-3')}
                    <span className={`text-[9px] font-bold ${getStatusColor(apiStatus.status)}`}>
                      {apiStatus.status}
                    </span>
                  </div>

                  {/* Next fetch countdown */}
                  {apiStatus.enabled && apiStatus.status !== 'FETCHING' && apiStatus.status !== 'OFF' && (
                    <span className="text-[9px] text-white/25 tabular-nums w-8 text-right">{apiStatus.nextFetchIn}s</span>
                  )}
                </div>
              </button>

              {/* Expanded Detail Panel */}
              {isExpanded && (
                <div className="px-4 pb-3 bg-black/20">
                  {/* Quick Stats */}
                  <div className="flex gap-3 mb-2.5 pt-1">
                    <div className="flex-1 bg-white/5 rounded-lg p-2 text-center">
                      <div className="text-[8px] text-white/30 uppercase tracking-wider mb-0.5">Calls</div>
                      <div className="text-sm font-bold text-white/80 tabular-nums">{apiStatus.totalCalls}</div>
                    </div>
                    <div className="flex-1 bg-white/5 rounded-lg p-2 text-center">
                      <div className="text-[8px] text-white/30 uppercase tracking-wider mb-0.5">Errors</div>
                      <div className={`text-sm font-bold tabular-nums ${apiStatus.totalErrors > 0 ? 'text-red-400' : 'text-white/80'}`}>{apiStatus.totalErrors}</div>
                    </div>
                    <div className="flex-1 bg-white/5 rounded-lg p-2 text-center">
                      <div className="text-[8px] text-white/30 uppercase tracking-wider mb-0.5">Fallbacks</div>
                      <div className={`text-sm font-bold tabular-nums ${apiStatus.totalFallbacks > 0 ? 'text-orange-400' : 'text-white/80'}`}>{apiStatus.totalFallbacks}</div>
                    </div>
                    <div className="flex-1 bg-white/5 rounded-lg p-2 text-center">
                      <div className="text-[8px] text-white/30 uppercase tracking-wider mb-0.5">Latency</div>
                      <div className="text-sm font-bold text-white/80 tabular-nums">{apiStatus.lastLatencyMs ?? '-'}ms</div>
                    </div>
                  </div>

                  {/* Last Error/Message */}
                  {apiStatus.lastMessage && (
                    <div className={`text-[10px] px-2.5 py-1.5 rounded-md mb-2.5 border-l-2 ${
                      apiStatus.status === 'ERROR' ? 'bg-red-500/10 border-l-red-500 text-red-300' :
                      apiStatus.status === 'RATE_LIMITED' ? 'bg-amber-500/10 border-l-amber-500 text-amber-300' :
                      apiStatus.status === 'FALLBACK' ? 'bg-orange-500/10 border-l-orange-500 text-orange-300' :
                      'bg-white/5 border-l-white/20 text-white/50'
                    }`}>
                      {apiStatus.lastMessage}
                    </div>
                  )}

                  {/* Call History */}
                  <div className="text-[8px] text-white/30 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Database className="w-3 h-3" /> Recent Calls ({apiStatus.callHistory.length})
                  </div>
                  <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
                    {apiStatus.callHistory.length === 0 ? (
                      <div className="text-[10px] text-white/20 text-center py-3">No calls recorded yet</div>
                    ) : (
                      apiStatus.callHistory.map((record, i) => (
                        <div key={i} className={`flex items-center justify-between bg-black/30 rounded px-2.5 py-1.5 border-l-2 ${getCallRecordStatusColor(record)}`}>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(record.status, 'w-2.5 h-2.5')}
                            <span className="text-[9px] text-white/40 tabular-nums">
                              {record.timestamp.toLocaleTimeString()}
                            </span>
                            <span className={`text-[8px] font-bold uppercase ${SOURCE_LABELS[record.source]?.color || 'text-slate-400'}`}>
                              {SOURCE_LABELS[record.source]?.label || record.source}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {record.dataSize !== undefined && (
                              <span className="text-[8px] text-white/20">{record.dataSize} items</span>
                            )}
                            {record.httpStatus && (
                              <span className={`text-[8px] tabular-nums ${record.httpStatus >= 400 ? 'text-red-400' : 'text-white/20'}`}>
                                {record.httpStatus}
                              </span>
                            )}
                            <span className={`text-[8px] tabular-nums ${record.latencyMs > 2000 ? 'text-red-400' : record.latencyMs > 500 ? 'text-amber-400' : 'text-white/20'}`}>
                              {record.latencyMs}ms
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Error detail for most recent failed call */}
                  {apiStatus.callHistory.length > 0 && apiStatus.callHistory[0].message && (
                    <div className="mt-2 text-[9px] text-white/30 bg-black/30 rounded px-2.5 py-1.5 break-all">
                      <span className="text-white/50 font-semibold">Last msg: </span>
                      {apiStatus.callHistory[0].message}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
