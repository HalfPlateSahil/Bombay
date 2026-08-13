"use client";

import React, { useState, useEffect } from "react";
import { Search, Compass, ShieldAlert, Activity, RefreshCw } from "lucide-react";
import { MUMBAI_LANDMARKS } from "../../services/api";

interface HeaderProps {
  mode: "live" | "disaster";
  onToggleMode: (mode: "live" | "disaster") => void;
  onSelectLocation: (loc: { name: string; lat: number; lon: number }) => void;
}

export const Header: React.FC<HeaderProps> = ({ mode, onToggleMode, onSelectLocation }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false }) + " IST"
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (query.trim().length > 1) {
      const filtered = [
        ...MUMBAI_LANDMARKS,
        { id: "dadar", name: "Dadar Central Junction", category: "Station", lat: 19.0180, lon: 72.8430 },
        { id: "kurla", name: "Kurla Suburban Hub", category: "Station", lat: 19.0650, lon: 72.8790 },
        { id: "nariman", name: "Nariman Point Financial Hub", category: "Landmark", lat: 18.9260, lon: 72.8200 },
        { id: "colaba", name: "Colaba Causeway", category: "Landmark", lat: 18.9150, lon: 72.8260 },
        { id: "versova", name: "Versova Beach", category: "Coastal", lat: 19.1360, lon: 72.8120 }
      ].filter((item) => item.name.toLowerCase().includes(query.toLowerCase()));
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  };

  return (
    <header className="absolute top-5 left-5 right-5 z-30 flex items-center justify-between gap-4 pointer-events-none">
      {/* Brand Title Badge */}
      <div className="pointer-events-auto flex items-center gap-3 bg-black/40 backdrop-blur-xl border border-white/10 pl-2 pr-5 py-2 rounded-full shadow-2xl shadow-black/50 transition-all duration-300 hover:bg-black/50">
        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/5">
          <Activity className="w-4 h-4 text-white" />
        </div>
        <div className="flex flex-col justify-center">
          <h1 className="text-[11px] font-medium text-white uppercase tracking-[0.2em] flex items-center gap-2 leading-none mb-1">
            MUMBAI ATLAS
            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/70 border border-white/5 tracking-widest">
              TWIN
            </span>
          </h1>
          <p className="text-[9px] text-white/40 font-mono tracking-wider leading-none">{currentTime}</p>
        </div>
      </div>

      {/* Location Search Bar */}
      <div className="pointer-events-auto relative flex-1 max-w-md">
        <div className="relative flex items-center bg-black/40 backdrop-blur-xl border border-white/10 rounded-full px-4 py-2 shadow-2xl shadow-black/50 focus-within:border-white/30 focus-within:bg-black/60 transition-all duration-300">
          <Search className="w-3.5 h-3.5 text-white/50 mr-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search Mumbai..."
            className="w-full bg-transparent text-[12px] text-white placeholder-white/30 focus:outline-none font-light tracking-wide"
          />
        </div>

        {/* Auto-complete Suggestions Dropdown */}
        {suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50">
            {suggestions.map((loc) => (
              <button
                key={loc.id || loc.name}
                onClick={() => {
                  onSelectLocation(loc);
                  setSearchQuery(loc.name);
                  setSuggestions([]);
                }}
                className="w-full text-left px-4 py-3 text-[12px] text-white/70 hover:bg-white/10 hover:text-white flex items-center justify-between border-b border-white/5 last:border-none transition-colors duration-200"
              >
                <span className="font-light tracking-wide">{loc.name}</span>
                <span className="text-[9px] text-white/40 uppercase tracking-[0.2em]">
                  {loc.category || "Location"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mode Toggle Controls */}
      <div className="pointer-events-auto flex items-center bg-black/40 backdrop-blur-xl border border-white/10 rounded-full p-1 shadow-2xl shadow-black/50">
        <button
          onClick={() => onToggleMode("live")}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] uppercase tracking-[0.15em] font-medium transition-all duration-300 ${
            mode === "live"
              ? "bg-white/15 text-white border border-white/10 shadow-lg"
              : "text-white/40 hover:text-white hover:bg-white/5"
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          Live
        </button>
        <button
          onClick={() => onToggleMode("disaster")}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] uppercase tracking-[0.15em] font-medium transition-all duration-300 ${
            mode === "disaster"
              ? "bg-hazardRed/20 text-hazardRed border border-hazardRed/30 shadow-lg shadow-hazardRed/20"
              : "text-white/40 hover:text-white hover:bg-white/5"
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          Disaster
        </button>
      </div>
    </header>
  );
};
