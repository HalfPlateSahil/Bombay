"use client";

import React, { useEffect, useRef } from "react";
import { TrafficData } from "../../types";

interface MumbaiMapProps {
  layers: Record<string, boolean>;
  traffic: TrafficData | null;
  selectedLocation: { name: string; lat: number; lon: number } | null;
  onMapClick: (lat: number, lon: number) => void;
}

export const MumbaiMap: React.FC<MumbaiMapProps> = ({
  layers,
  traffic,
  selectedLocation,
  onMapClick
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;

    // Dynamically load Leaflet for clean 60 FPS rendering
    import("leaflet").then((L) => {
      if (leafletMapRef.current) return;

      // Mumbai center coords (19.0760° N, 72.8777° E)
      const map = L.map(containerRef.current!, {
        center: [19.05, 72.86],
        zoom: 12,
        zoomControl: false,
        attributionControl: false
      });

      // Dark Mode Cyberpunk Tile Layer (CartoDB Dark Matter)
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        subdomains: "abcd"
      }).addTo(map);

      markersGroupRef.current = L.layerGroup().addTo(map);
      leafletMapRef.current = map;

      // Location click picking for disaster epicenter anchor
      map.on("click", (e: any) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });
    });

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  // Update center when selectedLocation changes (flyTo animation)
  useEffect(() => {
    if (leafletMapRef.current && selectedLocation) {
      leafletMapRef.current.flyTo([selectedLocation.lat, selectedLocation.lon], 14, {
        duration: 1.8
      });
    }
  }, [selectedLocation]);

  // Update map overlays (Traffic roads, Landmarks, Epicenter marker)
  useEffect(() => {
    if (!leafletMapRef.current || !markersGroupRef.current) return;
    import("leaflet").then((L) => {
      const mg = markersGroupRef.current;
      mg.clearLayers();

      // Render Traffic Roads Layer
      if (layers.traffic && traffic && traffic.roads) {
        for (const road of traffic.roads) {
          let color = "#10b981"; // Green
          if (road.congestion > 75) color = "#ef4444"; // Red
          else if (road.congestion > 45) color = "#f97316"; // Orange

          L.polyline(road.coordinates, {
            color: color,
            weight: 5,
            opacity: 0.85
          }).addTo(mg);
        }
      }

      // Render Selected Epicenter Marker
      if (selectedLocation) {
        const pulseIcon = L.divIcon({
          className: "custom-epicenter-marker",
          html: `
            <div class="relative flex items-center justify-center w-8 h-8">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-5 w-5 bg-cyan-500 border-2 border-white shadow-glowCyan"></span>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        L.marker([selectedLocation.lat, selectedLocation.lon], { icon: pulseIcon })
          .addTo(mg)
          .bindPopup(`<b>${selectedLocation.name}</b><br/>Lat: ${selectedLocation.lat.toFixed(4)}, Lon: ${selectedLocation.lon.toFixed(4)}`)
          .openPopup();
      }
    });
  }, [layers, traffic, selectedLocation]);

  return (
    <div className="relative w-full h-full bg-[#080c14] overflow-hidden">
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />
      <div ref={containerRef} className="w-full h-full z-0" />
      
      {/* Dynamic 3D Grid & Water Vignette Overlay */}
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_120px_rgba(8,12,20,0.85)] z-5" />
    </div>
  );
};
