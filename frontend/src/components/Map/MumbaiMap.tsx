"use client";

import React, { useEffect, useRef } from "react";
import { TrafficData, AQIData } from "../../types";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export type MapStyleType = "streets" | "outdoors" | "light" | "dark" | "satellite";

interface MumbaiMapProps {
  layers: Record<string, boolean>;
  traffic: TrafficData | null;
  aqi: AQIData | null;
  gisData: any;
  trains?: any;
  flights?: any;
  mapStyle: MapStyleType;
  selectedLocation: { name: string; lat: number; lon: number } | null;
  activeDisaster?: string | null;
  simulationResult?: any;
  simulationParams?: any;
  onMapClick: (lat: number, lon: number) => void;
  onMapLoad?: (map: any) => void;
}

// All OpenFreeMap official style URLs
// Docs: https://openfreemap.org/quick_start/
const MAPBOX_STYLES: Record<string, string> = {
  streets: "mapbox://styles/mapbox/streets-v12",
  outdoors: "mapbox://styles/mapbox/outdoors-v12",
  light: "mapbox://styles/mapbox/light-v11",
  dark: "mapbox://styles/mapbox/dark-v11",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12"
};

// Inject Mapbox Access Token
mapboxgl.accessToken = "pk.eyJ1IjoiaGFsZnBsYXRlc2FoaWwiLCJhIjoiY21zdGY5ZXI5MGlmcDJ5cnlvM20zNnlxaCJ9.hIFOeLt9Vg_YerMUf68QZA";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

// Helper to guarantee map images (train, plane) are always registered
const ensureCustomIcons = (map: any) => {
  if (!map) return;
  if (!map.hasImage("train-icon")) {
    const imgTrain = new Image(24, 24);
    imgTrain.onload = () => {
      try {
        if (map && !map.hasImage("train-icon")) map.addImage("train-icon", imgTrain);
      } catch (e) {}
    };
    imgTrain.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent('<svg width="24" height="24" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8 2 4 2.5 4 6v9.5a3.5 3.5 0 0 0 3.5 3.5h1l-1.5 1.5v.5h10v-.5L15.5 19h1a3.5 3.5 0 0 0 3.5-3.5V6c0-3.5-4-4-8-4zm0 2c3.5 0 6 .5 6 2v2H6V6c0-1.5 2.5-2 6-2zm-4.5 11a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm9 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>');
  }

  if (!map.hasImage("plane-icon")) {
    const imgPlane = new Image(64, 64);
    imgPlane.onload = () => {
      try {
        if (map && !map.hasImage("plane-icon")) map.addImage("plane-icon", imgPlane);
      } catch (e) {}
    };
    imgPlane.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent('<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><g transform="translate(0, 4)"><path fill="rgba(0,0,0,0.4)" d="M32 4 C35 4, 36 6, 36 10 L36 24 L58 42 L58 46 L36 40 L36 52 L42 58 L42 60 L32 58 L22 60 L22 58 L28 52 L28 40 L6 46 L6 42 L28 24 L28 10 C28 6, 29 4, 32 4 Z"/></g><path fill="#f59e0b" stroke="#ffffff" stroke-width="2.2" stroke-linejoin="round" d="M32 4 C35 4, 36 6, 36 10 L36 24 L58 42 L58 46 L36 40 L36 52 L42 58 L42 60 L32 58 L22 60 L22 58 L28 52 L28 40 L6 46 L6 42 L28 24 L28 10 C28 6, 29 4, 32 4 Z"/></svg>');
  }
};

// Determine if a style is dark-themed for color selection
const isDarkStyle = (style: MapStyleType) => style === "dark";

export const MumbaiMap: React.FC<MumbaiMapProps> = ({
  layers,
  traffic,
  aqi,
  gisData,
  trains,
  flights,
  mapStyle,
  selectedLocation,
  activeDisaster,
  simulationResult,
  simulationParams,
  onMapClick,
  onMapLoad
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);

  // Authoritative state refs to eliminate stale closure bugs across asynchronous map callbacks
  const layersRef = useRef(layers);
  layersRef.current = layers;

  const gisDataRef = useRef(gisData);
  gisDataRef.current = gisData;

  const trafficRef = useRef(traffic);
  trafficRef.current = traffic;

  const aqiRef = useRef(aqi);
  aqiRef.current = aqi;

  const trainsRef = useRef(trains);
  trainsRef.current = trains;

  const flightsRef = useRef(flights);
  flightsRef.current = flights;

  const mapStyleRef = useRef(mapStyle);
  mapStyleRef.current = mapStyle;
  
  // Flight Animation Refs
  const flightDataRef = useRef<any>(null);
  const lastFlightFrameTime = useRef<number>(0);
  const flightAnimFrameId = useRef<number>(0);
  const markerRef = useRef<any>(null);

  // Train Animation Refs
  const trainDataRef = useRef<any>(null);
  const lastTrainFrameTime = useRef<number>(0);
  const trainAnimFrameId = useRef<number>(0);

  // Metro Animation Refs
  const metroTrainsRef = useRef<any>(null);
  const lastMetroFrameTime = useRef<number>(0);
  const metroAnimFrameId = useRef<number>(0);
  const lastMetroDataRef = useRef<any>(null);

  // Flood Animation & Debounce Refs
  const floodAnimFrameId = useRef<number>(0);
  const lastFloodElevRef = useRef<number>(-1);
  const floodDebounceTimerRef = useRef<any>(null);

  // Suppress transient Mapbox v3 symbol placement crash from popping Next.js error modal
  useEffect(() => {
    const handleGlobalError = (e: ErrorEvent) => {
      if (e?.message && (e.message.includes("continuePlacement") || e.message.includes("reading 'get'"))) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    };
    window.addEventListener("error", handleGlobalError, true);
    return () => window.removeEventListener("error", handleGlobalError, true);
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // 3D Building Engine — Uses OpenFreeMap's native openmaptiles vector source
  // The building source-layer has: render_height, render_min_height, height,
  // min_height fields from OpenStreetMap data via OpenMapTiles schema.
  // ──────────────────────────────────────────────────────────────────────────
  const setup3DBuildings = (map: any, style: MapStyleType, show: boolean) => {
    if (!map || !map.style) return;
    const isVis = show !== undefined ? show : Boolean(layersRef.current.buildings);
    const dark = isDarkStyle(style);
    if (style === "satellite") return;

    // Permanently disable 3D terrain elevation mesh to keep tracks and bridges flat and straight
    if (map.getTerrain()) {
      map.setTerrain(null);
    }
    if (map.getSource("mapbox-dem")) {
      try {
        map.removeSource("mapbox-dem");
      } catch (e) {}
    }

    if (!map.getLayer("ofm-3d-buildings")) {
        map.addLayer({
          id: "ofm-3d-buildings",
          source: "composite",
          "source-layer": "building",
          filter: ["==", "extrude", "true"],
          type: "fill-extrusion",
          minzoom: 14,
          layout: {
            visibility: isVis ? "visible" : "none"
          },
          paint: {
            "fill-extrusion-color": dark ? "#0e7490" : "#aaa",
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-base": ["get", "min_height"],
            "fill-extrusion-opacity": isVis ? 0.8 : 0
          }
        });
    } else {
      map.setLayoutProperty("ofm-3d-buildings", "visibility", isVis ? "visible" : "none");
      map.setPaintProperty("ofm-3d-buildings", "fill-extrusion-opacity", isVis ? 0.8 : 0);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Procedural Traffic Overlay Layer
  // ──────────────────────────────────────────────────────────────────────────
  const setupTraffic = (map: any, trData: TrafficData | null, show: boolean) => {
    if (!map || !map.style || !trData) return;
    const isVis = show !== undefined ? show : Boolean(layersRef.current.traffic);

    // Cleanup legacy GeoJSON traffic lines if present
    if (map.getLayer("traffic-lines")) {
      map.removeLayer("traffic-lines");
    }
    if (map.getSource("traffic-source")) {
      map.removeSource("traffic-source");
    }

    // Advanced Procedural Traffic Shader tied to REAL road geometry
    if (!map.getLayer("ofm-traffic-overlay")) {
      
      // A shifting integer based on the current minute to simulate changing traffic patterns over time
      const timeShift = Math.floor(new Date().getMinutes() / 5);

      map.addLayer({
        id: "ofm-traffic-overlay",
        type: "line",
        source: "composite",
        "source-layer": "road",
        // Only show traffic on significant arterial roads
        filter: ["in", "class", "motorway", "trunk", "primary", "secondary"],
        layout: {
          "line-join": "round",
          "line-cap": "round",
          visibility: isVis ? "visible" : "none"
        },
        paint: {
          // Generate a deterministic pseudo-random hash per road segment
          "line-color": [
            "let",
            // Seed uses the feature ID (or string length of name as fallback) + timeShift
            "seed", ["%", ["+", ["coalesce", ["id"], ["length", ["coalesce", ["get", "name"], "a"]]], timeShift], 100],
            ["case",
              [">", ["var", "seed"], 85], "#ef4444", // 15% severe red
              [">", ["var", "seed"], 60], "#f97316", // 25% moderate orange
              "#10b981" // 60% free-flow green
            ]
          ],
          // Dynamically scale width based on zoom for a beautiful overlay
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10, 1.5,
            14, 4,
            18, 12
          ],
          "line-opacity": 0.85
        }
      },
      // Insert above buildings/waterways but below labels
      map.getLayer("ofm-3d-buildings") ? "ofm-3d-buildings" : undefined
      );
    } else {
      map.setLayoutProperty(
        "ofm-traffic-overlay",
        "visibility",
        isVis ? "visible" : "none"
      );
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // AQI Heatmap Layer
  // ──────────────────────────────────────────────────────────────────────────
  const setupAQI = (map: any, aqiData: AQIData | null, show: boolean) => {
    if (!map || !map.style || !aqiData || !aqiData.stations) return;
    const isVis = show !== undefined ? show : Boolean(layersRef.current.aqi);
    const aqiVis = isVis ? "visible" : "none";

    const aqiGeoJSON: any = {
      type: "FeatureCollection",
      features: aqiData.stations.map((st) => ({
        type: "Feature",
        properties: {
          aqi: st.aqi,
          name: st.name,
          category: st.category,
          pm2_5: st.pm2_5 ?? 15,
          pm10: st.pm10 ?? 30,
          isGrid: (st as any).isGrid ? 1 : 0
        },
        geometry: {
          type: "Point",
          coordinates: [st.lon, st.lat]
        }
      }))
    };

    if (!map.getSource("aqi-source")) {
      map.addSource("aqi-source", {
        type: "geojson",
        data: aqiGeoJSON
      });
    } else {
      map.getSource("aqi-source").setData(aqiGeoJSON);
    }

    // 1. Continuous Heatmap Layer (Interpolated AQI Field across Mumbai)
    if (!map.getLayer("aqi-heatmap")) {
      map.addLayer(
        {
          id: "aqi-heatmap",
          type: "heatmap",
          source: "aqi-source",
          maxzoom: 17,
          layout: {
            visibility: aqiVis
          },
          paint: {
            "heatmap-weight": [
              "interpolate",
              ["linear"],
              ["get", "aqi"],
              0, 0.2,
              50, 0.5,
              100, 0.8,
              200, 1.2,
              300, 2.0
            ],
            "heatmap-intensity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              8, 0.6,
              11, 1.2,
              14, 2.0
            ],
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0, "rgba(0, 0, 0, 0)",
              0.15, "rgba(34, 197, 94, 0.4)",   // Good (Green)
              0.35, "rgba(234, 179, 8, 0.5)",   // Satisfactory (Yellow)
              0.55, "rgba(249, 115, 22, 0.6)",  // Moderate (Orange)
              0.75, "rgba(239, 68, 68, 0.7)",   // Poor (Red)
              0.95, "rgba(168, 85, 247, 0.85)"  // Severe (Purple)
            ],
            "heatmap-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              8, 22,
              11, 48,
              14, 80
            ],
            "heatmap-opacity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              8, 0.85,
              13, 0.65,
              16, 0.3
            ]
          }
        },
        // Insert heatmap underneath 3D buildings so buildings stand tall above it
        map.getLayer("ofm-3d-buildings") ? "ofm-3d-buildings" : undefined
      );
    } else {
      map.setLayoutProperty("aqi-heatmap", "visibility", aqiVis);
    }

    // 2. Solid Badge Layer for Distinct Regional Stations
    if (!map.getLayer("aqi-coverage-circles")) {
      map.addLayer({
        id: "aqi-coverage-circles",
        type: "circle",
        source: "aqi-source",
        filter: ["!=", ["get", "isGrid"], 1],
        layout: {
          visibility: aqiVis
        },
        paint: {
          "circle-blur": 0,
          "circle-opacity": 0.95,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            9, 12,
            12, 15,
            15, 19,
            18, 23
          ],
          "circle-color": [
            "step",
            ["get", "aqi"],
            "#22c55e",    // 0-50: Good (Green)
            51, "#eab308",  // 51-100: Satisfactory (Yellow)
            101, "#f97316", // 101-200: Moderate (Orange)
            201, "#ef4444", // 201-300: Poor (Red)
            301, "#a855f7"  // 301+: Severe (Purple)
          ]
        }
      });
    } else {
      map.setLayoutProperty("aqi-coverage-circles", "visibility", aqiVis);
    }

    // 3. Exact Value Symbol Layer (Numbers inside the badge)
    if (!map.getLayer("aqi-value-labels")) {
      map.addLayer({
        id: "aqi-value-labels",
        type: "symbol",
        source: "aqi-source",
        filter: ["!=", ["get", "isGrid"], 1],
        layout: {
          visibility: aqiVis,
          "text-field": ["to-string", ["get", "aqi"]],
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            9, 9,
            12, 11,
            15, 14,
            18, 16
          ],
          "text-offset": [0, 0],
          "text-anchor": "center",
          "text-allow-overlap": true,
          "text-ignore-placement": true
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "rgba(0,0,0,0.7)",
          "text-halo-width": 1.5
        }
      });
    } else {
      map.setLayoutProperty("aqi-value-labels", "visibility", aqiVis);
    }

    // 4. Region Name Labels below badges
    if (!map.getLayer("aqi-station-labels")) {
      map.addLayer({
        id: "aqi-station-labels",
        type: "symbol",
        source: "aqi-source",
        filter: ["!=", ["get", "isGrid"], 1],
        minzoom: 10,
        layout: {
          visibility: aqiVis,
          "text-field": ["get", "name"],
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10, 10,
            13, 12,
            16, 14
          ],
          "text-offset": [0, 1.6],
          "text-anchor": "top",
          "text-allow-overlap": false,
          "text-optional": true
        },
        paint: {
          "text-color": "#f8fafc",
          "text-halo-color": "rgba(15, 23, 42, 0.95)",
          "text-halo-width": 2
        }
      });
    } else {
      map.setLayoutProperty("aqi-station-labels", "visibility", aqiVis);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Procedural Train Simulation Layer
  // ──────────────────────────────────────────────────────────────────────────
  const setupRailways = (map: any, gisData: any, trainsData: any, show: boolean) => {
    if (!map || !map.style || !gisData || !gisData.railways) return;
    const isVis = show !== undefined ? show : Boolean(layersRef.current.railways);
    const visStr = isVis ? "visible" : "none";

    // 1. Setup Tracks
    const tracksGeoJSON: any = {
      type: "FeatureCollection",
      features: gisData.railways.map((r: any) => ({
        type: "Feature",
        properties: { line: r.line, color: r.color },
        geometry: {
          type: "LineString",
          coordinates: r.coordinates.map((c: any) => [c[1], c[0]]) // reverse to lon,lat
        }
      }))
    };

    if (!map.getSource("railway-tracks")) {
      map.addSource("railway-tracks", { type: "geojson", data: tracksGeoJSON });
      map.addLayer({
        id: "railway-tracks-layer",
        type: "line",
        source: "railway-tracks",
        layout: {
          "line-join": "round",
          "line-cap": "round",
          visibility: visStr
        },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 6,
          "line-opacity": 0.6
        }
      });
    } else {
      map.getSource("railway-tracks").setData(tracksGeoJSON);
      map.setLayoutProperty("railway-tracks-layer", "visibility", visStr);
    }

    // 2. Setup Stations
    const stationsGeoJSON: any = {
      type: "FeatureCollection",
      features: gisData.railways.flatMap((r: any) => 
        r.station_coords.map((st: any) => ({
          type: "Feature",
          properties: { name: st.name, color: r.color },
          geometry: { type: "Point", coordinates: [st.lon, st.lat] }
        }))
      )
    };

    if (!map.getSource("railway-stations")) {
      map.addSource("railway-stations", { type: "geojson", data: stationsGeoJSON });
      map.addLayer({
        id: "railway-stations-layer",
        type: "circle",
        source: "railway-stations",
        layout: { visibility: visStr },
        paint: {
          "circle-radius": 4,
          "circle-color": "#ffffff",
          "circle-stroke-width": 2,
          "circle-stroke-color": ["get", "color"]
        }
      });
      
      map.addLayer({
        id: "railway-stations-label-layer",
        type: "symbol",
        source: "railway-stations",
        layout: {
          "visibility": visStr,
          "text-field": ["get", "name"],
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-size": 14,
          "text-offset": [0, 1.2],
          "text-anchor": "top"
        },
        paint: {
          "text-color": "#0f172a",
          "text-halo-color": "#ffffff",
          "text-halo-width": 2
        }
      });
    } else {
      map.getSource("railway-stations").setData(stationsGeoJSON);
      map.setLayoutProperty("railway-stations-layer", "visibility", visStr);
      if (map.getLayer("railway-stations-label-layer")) {
        map.setLayoutProperty("railway-stations-label-layer", "visibility", visStr);
      }
    }

    // 3. Setup Live Trains
    if (trainsData && trainsData.features && trainsData.features.length > 0) {
      if (!map.getSource("live-trains")) {
        map.addSource("live-trains", { type: "geojson", data: trainsData });

        try {
          if (!map.getSource("live-trains-3d")) {
            map.addSource("live-trains-3d", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          }

          if (!map.getLayer("live-trains-3d-layer")) {
            map.addLayer({
              id: "live-trains-3d-layer",
              type: "fill-extrusion",
              source: "live-trains-3d",
              layout: { visibility: visStr },
              paint: {
                "fill-extrusion-color": ["get", "render_color"],
                "fill-extrusion-height": ["get", "render_height"],
                "fill-extrusion-base": ["get", "render_base"],
                "fill-extrusion-opacity": 1.0
              }
            });
          }
        } catch(e) {
          console.warn("Extrusion layer failed", e);
        }

        try {
          if (!map.getLayer("live-trains-bg-layer")) {
            map.addLayer({
              id: "live-trains-bg-layer",
              type: "circle",
              source: "live-trains",
              layout: { visibility: visStr },
              paint: {
                "circle-radius": [
                  "case",
                  ["==", ["get", "live_source"], "yatri_gps"], 15,
                  14
                ],
                "circle-color": ["get", "color"],
                "circle-stroke-width": [
                  "case",
                  ["==", ["get", "live_source"], "yatri_gps"], 3,
                  2
                ],
                "circle-stroke-color": [
                  "case",
                  ["==", ["get", "live_source"], "yatri_gps"], "#10b981",
                  "#ffffff"
                ],
                "circle-opacity": 1.0
              }
            });
          }
          if (!map.getLayer("live-trains-layer")) {
            map.addLayer({
              id: "live-trains-layer",
              type: "symbol",
              source: "live-trains",
              layout: {
                "visibility": visStr,
                "icon-image": "train-icon",
                "icon-size": 0.7,
                "icon-allow-overlap": true,
                "icon-ignore-placement": true
              }
            });
          }
        } catch(e) {
          console.warn("Fallback failed", e);
        }
      } else {
        map.getSource("live-trains").setData(trainsData);
        if (map.getLayer("live-trains-bg-layer")) map.setLayoutProperty("live-trains-bg-layer", "visibility", visStr);
        if (map.getLayer("live-trains-layer")) map.setLayoutProperty("live-trains-layer", "visibility", visStr);
        if (map.getLayer("live-trains-3d-layer")) map.setLayoutProperty("live-trains-3d-layer", "visibility", visStr);
      }
    }
  };


  // ──────────────────────────────────────────────────────────────────────────
  // Train Animation Loop
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (trains && trains.features) {
      if (!trainDataRef.current) {
        trainDataRef.current = JSON.parse(JSON.stringify(trains));
      } else {
        // Merge to prevent animation glitching/jumping
        const currentFeatures = trainDataRef.current.features;
        const newFeatures = JSON.parse(JSON.stringify(trains)).features;
        
        const currentMap = new Map();
        currentFeatures.forEach((f: any) => currentMap.set(f.properties.id, f));
        
        const mergedFeatures = newFeatures.map((nf: any) => {
          const existing = currentMap.get(nf.properties.id);
          if (existing) {
            // PLAYBACK BUFFER: Store the previous target and the new target
            nf.properties.prevServerCoords = existing.properties.serverCoords || existing.geometry.coordinates;
            nf.properties.serverCoords = nf.geometry.coordinates;
            
            // Set the transition timer for this update
            nf.properties.transitionStartTime = Date.now();
            
            // Keep visual coordinates exactly where the interpolation currently is
            nf.geometry.coordinates = [...existing.geometry.coordinates]; 
          } else {
            nf.properties.serverCoords = [...nf.geometry.coordinates];
            nf.properties.prevServerCoords = [...nf.geometry.coordinates];
            nf.properties.transitionStartTime = Date.now();
          }
          return nf;
        });
        
        trainDataRef.current = { ...trains, features: mergedFeatures };
      }
    }
  }, [trains]);

  useEffect(() => {
    const animateTrains = (time: number) => {
      trainAnimFrameId.current = requestAnimationFrame(animateTrains);
      
      const map = mapRef.current;
      if (!map || !map.style || !map.getSource("live-trains") || !trainDataRef.current || !layersRef.current.railways) {
        lastTrainFrameTime.current = time;
        return;
      }
      
      const dt = (time - lastTrainFrameTime.current) / 1000.0;
      lastTrainFrameTime.current = time;
      
      if (dt > 0 && dt < 1) { 
        const features = trainDataRef.current.features;
        let changed = false;
        const trainPolygons: any = { type: "FeatureCollection", features: [] };
        
        const getTrainPolygon = (lon: number, lat: number, heading: number, hl: number, hw: number) => {
          const lat_m = 111320.0;
          const lon_m = 111320.0 * Math.cos(lat * Math.PI / 180.0);
          const rad = heading * Math.PI / 180.0;
          const fx = Math.sin(rad), fy = Math.cos(rad);
          const rx = Math.cos(rad), ry = -Math.sin(rad);
          
          return [
            [lon + (fx*hl - rx*hw)/lon_m, lat + (fy*hl - ry*hw)/lat_m],
            [lon + (fx*hl + rx*hw)/lon_m, lat + (fy*hl + ry*hw)/lat_m],
            [lon + (-fx*hl + rx*hw)/lon_m, lat + (-fy*hl + ry*hw)/lat_m],
            [lon + (-fx*hl - rx*hw)/lon_m, lat + (-fy*hl - ry*hw)/lat_m],
            [lon + (fx*hl - rx*hw)/lon_m, lat + (fy*hl - ry*hw)/lat_m]
          ];
        };
        
        const zoom = map.getZoom();
        const scale = zoom < 14 ? (14 - zoom) * 2 : 1; 

        for (let i = 0; i < features.length; i++) {
          const f = features[i];
          const p = f.properties;
          const coords = f.geometry.coordinates;
          
          // Playback Buffer Animation
          if (p.serverCoords && p.prevServerCoords && p.transitionStartTime) {
             const tCoords = p.serverCoords;
             const pCoords = p.prevServerCoords;
             
             // Time elapsed since the new GPS target arrived
             const elapsedMs = Date.now() - p.transitionStartTime;
             // We interpolate over 5.5 seconds (slightly longer than 5s polling to prevent stuttering)
             const durationMs = 5500.0; 
             const progress = Math.min(1.0, elapsedMs / durationMs);
             
             if (p.status === "At Station") {
                 // Gently glide into the station
                 const lerpFactor = Math.min(1.0, dt * 3.0); 
                 const nLon = coords[0] + (tCoords[0] - coords[0]) * lerpFactor;
                 const nLat = coords[1] + (tCoords[1] - coords[1]) * lerpFactor;
                 if (Math.abs(nLon - tCoords[0]) > 0.000001 || Math.abs(nLat - tCoords[1]) > 0.000001) {
                    f.geometry.coordinates = [nLon, nLat];
                    changed = true;
                 }
             } else {
                 // CONSTANT SPEED PLAYBACK BUFFER
                 // Moves linearly from Point A to Point B over the exact time interval
                 const nLon = pCoords[0] + (tCoords[0] - pCoords[0]) * progress;
                 const nLat = pCoords[1] + (tCoords[1] - pCoords[1]) * progress;
                 
                 // If the target is different from the previous, we are moving, so always update
                 if (pCoords[0] !== tCoords[0] || pCoords[1] !== tCoords[1]) {
                    f.geometry.coordinates = [nLon, nLat];
                    changed = true;
                 }
             }
          }
          
          if (p.heading !== undefined) {
             const lon = f.geometry.coordinates[0];
             const lat = f.geometry.coordinates[1];
             
             const hl = 30.0 * scale; 
             const hw = 1.6 * scale;  
             const stripeHw = 1.65 * scale; 
             
             // White Main Body
             trainPolygons.features.push({
               type: "Feature",
               properties: { ...p, render_color: "#f8fafc", render_height: 4.2, render_base: 0.5 },
               geometry: { type: "Polygon", coordinates: [getTrainPolygon(lon, lat, p.heading, hl, hw)] }
             });
             
             // Magenta/Purple Stripe (sticks out slightly, placed on the lower half)
             trainPolygons.features.push({
               type: "Feature",
               properties: { ...p, render_color: "#b026a0", render_height: 2.2, render_base: 0.8 },
               geometry: { type: "Polygon", coordinates: [getTrainPolygon(lon, lat, p.heading, hl + (0.1 * scale), stripeHw)] }
             });

             // Dark Gray Roof (slightly recessed)
             trainPolygons.features.push({
               type: "Feature",
               properties: { ...p, render_color: "#475569", render_height: 4.5, render_base: 4.2 },
               geometry: { type: "Polygon", coordinates: [getTrainPolygon(lon, lat, p.heading, hl - (0.5 * scale), hw - (0.1 * scale))] }
             });
          }
        }
        
        if (changed || trainPolygons.features.length > 0) {
          (map.getSource("live-trains") as any).setData(trainDataRef.current);
          if (map.getSource("live-trains-3d")) {
            (map.getSource("live-trains-3d") as any).setData(trainPolygons);
          }
        }
      }
    };
    
    trainAnimFrameId.current = requestAnimationFrame(animateTrains);
    
    return () => {
      if (trainAnimFrameId.current) cancelAnimationFrame(trainAnimFrameId.current);
    };
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // Flight Animation Loop
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (flights && flights.features) {
      flightDataRef.current = JSON.parse(JSON.stringify(flights));
    }
  }, [flights]);

  useEffect(() => {
    const animateFlights = (time: number) => {
      flightAnimFrameId.current = requestAnimationFrame(animateFlights);
      
      const map = mapRef.current;
      if (!map || !map.style || !map.getSource("live-flights") || !flightDataRef.current || !layersRef.current.flights) {
        lastFlightFrameTime.current = time;
        return;
      }
      
      const dt = (time - lastFlightFrameTime.current) / 1000.0;
      lastFlightFrameTime.current = time;
      
      if (dt > 0 && dt < 1) { // Max 1s delta to avoid big jumps if tab was inactive
        const features = flightDataRef.current.features;
        let changed = false;
        
        for (let i = 0; i < features.length; i++) {
          const f = features[i];
          const p = f.properties;
          const coords = f.geometry.coordinates;
          
          if (p.velocity_ms > 0 && p.heading !== undefined) {
            const distance = p.velocity_ms * dt; // meters
            const headingRad = (p.heading * Math.PI) / 180.0;
            const latRad = (coords[1] * Math.PI) / 180.0;
            
            // Approximate lat/lon change (1 deg lat = 111320m)
            const dLat = (distance * Math.cos(headingRad)) / 111320.0;
            const dLon = (distance * Math.sin(headingRad)) / (111320.0 * Math.cos(latRad));
            
            f.geometry.coordinates = [coords[0] + dLon, coords[1] + dLat];
            changed = true;
          }
        }
        
        if (changed) {
          (map.getSource("live-flights") as any).setData(flightDataRef.current);
        }
      }
    };
    
    flightAnimFrameId.current = requestAnimationFrame(animateFlights);
    
    return () => {
      if (flightAnimFrameId.current) cancelAnimationFrame(flightAnimFrameId.current);
    };
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // Dedicated helper to immediately sync visibility of all map layers
  // ──────────────────────────────────────────────────────────────────────────
  const ALL_LAYER_GROUPS: Record<string, string[]> = {
    buildings: ["ofm-3d-buildings"],
    traffic: ["ofm-traffic-overlay", "traffic-lines"],
    railways: [
      "railway-tracks-layer",
      "railway-stations-layer",
      "railway-stations-label-layer",
      "live-trains-layer",
      "live-trains-bg-layer",
      "live-trains-3d-layer"
    ],
    metros: [
      "metro-bridges-3d-layer",
      "metro-tracks-glow-layer",
      "metro-tracks-core-layer",
      "metro-tracks-center-layer",
      "metro-stations-halo-layer",
      "metro-stations-core-layer",
      "metro-stations-label-layer",
      "live-metro-trains-3d-layer",
      "live-metro-trains-glow-layer"
    ],
    flights: [
      "live-flights-layer",
      "live-flights-label-layer",
      "live-flights-3d-layer"
    ],
    aqi: [
      "aqi-heatmap",
      "aqi-coverage-circles",
      "aqi-value-labels",
      "aqi-station-labels"
    ],
    labels: [
      "ward-labels-layer"
    ]
  };

  const syncAllLayerVisibilities = (map: any) => {
    if (!map || !map.style) return;
    const curLayers = layersRef.current;

    for (const [groupKey, layerIds] of Object.entries(ALL_LAYER_GROUPS)) {
      const isVisible = Boolean(curLayers[groupKey]);
      const visStr = isVisible ? "visible" : "none";

      for (const layerId of layerIds) {
        try {
          if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, "visibility", visStr);
            if (layerId === "ofm-3d-buildings") {
              map.setPaintProperty("ofm-3d-buildings", "fill-extrusion-opacity", isVisible ? 0.8 : 0);
            }
          }
        } catch (err) {}
      }
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Procedural 3D Metro Network & Infrastructure Layer
  // ──────────────────────────────────────────────────────────────────────────
  const setupMetros = (map: any, gisData: any, show: boolean) => {
    if (!map || !map.style || !gisData || !gisData.metros) return;
    const isVis = show !== undefined ? show : Boolean(layersRef.current.metros);
    const metroVisibility = isVis ? "visible" : "none";
    
    // 1. Setup 3D Viaducts, Pillars, and 3D Station Models
    if (gisData.metro_bridges_3d && gisData.metro_bridges_3d.features) {
      if (!map.getSource("metro-bridges-3d")) {
        map.addSource("metro-bridges-3d", { 
          type: "geojson", 
          data: gisData.metro_bridges_3d 
        });

        try {
          map.addLayer({
            id: "metro-bridges-3d-layer",
            type: "fill-extrusion",
            source: "metro-bridges-3d",
            layout: { visibility: metroVisibility },
            paint: {
              "fill-extrusion-color": ["coalesce", ["get", "color"], "#1e293b"],
              "fill-extrusion-height": ["coalesce", ["get", "height"], 20],
              "fill-extrusion-base": ["coalesce", ["get", "base_height"], 14],
              "fill-extrusion-opacity": 0.95
            }
          });
        } catch (err) {
          console.warn("Failed to add metro-bridges-3d-layer", err);
        }
      } else {
        if (lastMetroDataRef.current !== gisData.metro_bridges_3d) {
          map.getSource("metro-bridges-3d").setData(gisData.metro_bridges_3d);
        }
        if (map.getLayer("metro-bridges-3d-layer")) {
          map.setLayoutProperty("metro-bridges-3d-layer", "visibility", metroVisibility);
        }
      }
    }

    // 2. Setup Glowing Track Centerlines & Route Name Badges
    const tracksGeoJSON: any = {
      type: "FeatureCollection",
      features: gisData.metros.map((r: any) => ({
        type: "Feature",
        properties: { 
          id: r.id, 
          line: r.line, 
          short_name: r.short_name || r.line,
          color: r.color,
          status: r.status || "Operational",
          type: r.type || "Elevated Viaduct"
        },
        geometry: {
          type: "LineString",
          coordinates: (r.coordinates || (r.segments && r.segments[0]) || []).map((c: any) => [c[1], c[0]])
        }
      }))
    };
    
    if (!map.getSource("metro-tracks")) {
      map.addSource("metro-tracks", { type: "geojson", data: tracksGeoJSON });
      
      // Neon Glow Outer Line (Visible at city zoom < 12.5)
      try {
        map.addLayer({
          id: "metro-tracks-glow-layer",
          type: "line",
          source: "metro-tracks",
          maxzoom: 12.5,
          layout: {
            "line-join": "round",
            "line-cap": "round",
            visibility: metroVisibility
          },
          paint: {
            "line-color": ["get", "color"],
            "line-width": [
              "interpolate", ["linear"], ["zoom"],
              8, 6,
              11, 8,
              12.5, 10
            ],
            "line-blur": 2,
            "line-opacity": 0.8
          }
        });
      } catch (e) {
        console.warn("Failed to add metro-tracks-glow-layer", e);
      }

      // Sharp Core Track Line (Visible at city zoom < 12.5)
      try {
        map.addLayer({
          id: "metro-tracks-core-layer",
          type: "line",
          source: "metro-tracks",
          maxzoom: 12.5,
          layout: {
            "line-join": "round",
            "line-cap": "round",
            visibility: metroVisibility
          },
          paint: {
            "line-color": ["get", "color"],
            "line-width": [
              "interpolate", ["linear"], ["zoom"],
              8, 3,
              11, 4.5,
              12.5, 6
            ],
            "line-opacity": 1.0
          }
        });
      } catch (e) {
        console.warn("Failed to add metro-tracks-core-layer", e);
      }

      // White Centerline Rail Strip (Visible at city zoom < 12.5)
      try {
        map.addLayer({
          id: "metro-tracks-center-layer",
          type: "line",
          source: "metro-tracks",
          maxzoom: 12.5,
          layout: {
            "line-join": "round",
            "line-cap": "round",
            visibility: metroVisibility
          },
          paint: {
            "line-color": "#ffffff",
            "line-width": 1.5,
            "line-opacity": 0.85
          }
        });
      } catch (e) {
        console.warn("Failed to add metro-tracks-center-layer", e);
      }
    } else {
      map.getSource("metro-tracks").setData(tracksGeoJSON);
      if (map.getLayer("metro-tracks-glow-layer")) map.setLayoutProperty("metro-tracks-glow-layer", "visibility", metroVisibility);
      if (map.getLayer("metro-tracks-core-layer")) map.setLayoutProperty("metro-tracks-core-layer", "visibility", metroVisibility);
      if (map.getLayer("metro-tracks-center-layer")) map.setLayoutProperty("metro-tracks-center-layer", "visibility", metroVisibility);
    }

    // 3. Setup Stations
    const stationsGeoJSON: any = {
      type: "FeatureCollection",
      features: gisData.metros.flatMap((r: any) => 
        (r.station_coords || []).map((st: any) => ({
          type: "Feature",
          properties: { 
            name: st.name, 
            line: r.line,
            short_name: r.short_name || r.line,
            color: r.color,
            status: r.status || "Operational",
            interchange: st.interchange || "None"
          },
          geometry: { type: "Point", coordinates: [st.lon, st.lat] }
        }))
      )
    };

    if (!map.getSource("metro-stations")) {
      map.addSource("metro-stations", { type: "geojson", data: stationsGeoJSON });
      
      // Station Pulse Halo
      try {
        map.addLayer({
          id: "metro-stations-halo-layer",
          type: "circle",
          source: "metro-stations",
          layout: { visibility: metroVisibility },
          paint: {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              10, 5,
              13, 8,
              16, 12
            ],
            "circle-color": ["get", "color"],
            "circle-opacity": 0.45
          }
        });
      } catch (e) {
        console.warn("Failed to add metro-stations-halo-layer", e);
      }

      // Station Core Marker
      try {
        map.addLayer({
          id: "metro-stations-core-layer",
          type: "circle",
          source: "metro-stations",
          layout: { visibility: metroVisibility },
          paint: {
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              10, 3,
              13, 4.5,
              16, 7
            ],
            "circle-color": "#ffffff",
            "circle-stroke-width": 2.5,
            "circle-stroke-color": ["get", "color"]
          }
        });
      } catch (e) {
        console.warn("Failed to add metro-stations-core-layer", e);
      }
      
      // Station Name Label
      try {
        map.addLayer({
          id: "metro-stations-label-layer",
          type: "symbol",
          source: "metro-stations",
          minzoom: 11,
          layout: {
            "visibility": metroVisibility,
            "text-field": ["get", "name"],
            "text-size": 12,
            "text-offset": [0, 1.3],
            "text-anchor": "top",
            "text-allow-overlap": false,
            "text-ignore-placement": false
          },
          paint: {
            "text-color": "#ffffff",
            "text-halo-color": "#0f172a",
            "text-halo-width": 2.5
          }
        });
      } catch (e) {
        console.warn("Failed to add metro-stations-label-layer", e);
      }
    } else {
      map.getSource("metro-stations").setData(stationsGeoJSON);
      if (map.getLayer("metro-stations-halo-layer")) map.setLayoutProperty("metro-stations-halo-layer", "visibility", metroVisibility);
      if (map.getLayer("metro-stations-core-layer")) map.setLayoutProperty("metro-stations-core-layer", "visibility", metroVisibility);
      if (map.getLayer("metro-stations-label-layer")) map.setLayoutProperty("metro-stations-label-layer", "visibility", metroVisibility);
    }

    // 4. Setup Live Procedural Metro Trains
    if (!map.getSource("live-metro-trains-3d")) {
      map.addSource("live-metro-trains-3d", { 
        type: "geojson", 
        data: { type: "FeatureCollection", features: [] } 
      });

      try {
        map.addLayer({
          id: "live-metro-trains-3d-layer",
          type: "fill-extrusion",
          source: "live-metro-trains-3d",
          layout: { visibility: metroVisibility },
          paint: {
            "fill-extrusion-color": ["coalesce", ["get", "color"], "#0085ca"],
            "fill-extrusion-height": ["coalesce", ["get", "height"], 18.4],
            "fill-extrusion-base": ["coalesce", ["get", "base_height"], 14.8],
            "fill-extrusion-opacity": 1.0
          }
        });
      } catch (e) {
        console.warn("Failed to add live-metro-trains-3d-layer", e);
      }
    } else {
      if (map.getLayer("live-metro-trains-3d-layer")) {
        map.setLayoutProperty("live-metro-trains-3d-layer", "visibility", metroVisibility);
      }
    }

    if (!map.getSource("live-metro-trains-glow")) {
      map.addSource("live-metro-trains-glow", { 
        type: "geojson", 
        data: { type: "FeatureCollection", features: [] } 
      });

      try {
        map.addLayer({
          id: "live-metro-trains-glow-layer",
          type: "circle",
          source: "live-metro-trains-glow",
          layout: { visibility: metroVisibility },
          paint: {
            "circle-radius": 6.5,
            "circle-color": ["get", "color"],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
            "circle-opacity": 1.0
          }
        });
      } catch (e) {
        console.warn("Failed to add live-metro-trains-glow-layer", e);
      }
    } else {
      if (map.getLayer("live-metro-trains-glow-layer")) {
        map.setLayoutProperty("live-metro-trains-glow-layer", "visibility", metroVisibility);
      }
    }

    // Initialize metro trains state if needed
    if (!metroTrainsRef.current && gisData.metros) {
      const initialTrains: any[] = [];
      gisData.metros.forEach((line: any) => {
        const coords = line.coordinates || (line.segments && line.segments[0]) || [];
        if (coords.length > 2) {
          initialTrains.push({
            id: `${line.id}_t1`,
            line_id: line.id,
            line_name: line.line,
            short_name: line.short_name || line.line,
            color: line.color,
            coords: coords,
            progress: 0.15,
            speed: 0.00025,
            direction: 1
          });
          initialTrains.push({
            id: `${line.id}_t2`,
            line_id: line.id,
            line_name: line.line,
            short_name: line.short_name || line.line,
            color: line.color,
            coords: coords,
            progress: 0.65,
            speed: 0.00025,
            direction: -1
          });
        }
      });
      metroTrainsRef.current = initialTrains;
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Metro Train Animation Loop
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const animateMetroTrains = (time: number) => {
      metroAnimFrameId.current = requestAnimationFrame(animateMetroTrains);
      
      const map = mapRef.current;
      if (!map || !map.style || !metroTrainsRef.current || !layersRef.current.metros) {
        lastMetroFrameTime.current = time;
        return;
      }
      
      const dt = lastMetroFrameTime.current ? (time - lastMetroFrameTime.current) / 1000.0 : 0.016;
      lastMetroFrameTime.current = time;

      if (dt > 0 && dt < 1) {
        const trains = metroTrainsRef.current;
        const trainPolygons: any = { type: "FeatureCollection", features: [] };
        const trainPoints: any = { type: "FeatureCollection", features: [] };

        trains.forEach((t: any) => {
          // Update progress
          t.progress += t.speed * t.direction * (dt * 60);
          if (t.progress >= 1.0) {
            t.progress = 1.0;
            t.direction = -1;
          } else if (t.progress <= 0.0) {
            t.progress = 0.0;
            t.direction = 1;
          }

          // Interpolate position along coordinates
          const coords = t.coords;
          const totalSegments = coords.length - 1;
          const currentPos = t.progress * totalSegments;
          const idx = Math.min(Math.floor(currentPos), totalSegments - 1);
          const segFraction = currentPos - idx;

          const p1 = coords[idx];
          const p2 = coords[idx + 1];

          const lat = p1[0] + (p2[0] - p1[0]) * segFraction;
          const lon = p1[1] + (p2[1] - p1[1]) * segFraction;

          const dy = p2[0] - p1[0];
          const dx = p2[1] - p1[1];
          const heading = Math.atan2(dy, dx);

          // Build 3D train coach polygon (~40m x 6m)
          const length_deg = 0.00035;
          const width_deg = 0.00007;
          const cos_h = Math.cos(heading);
          const sin_h = Math.sin(heading);

          const dx_fwd = (length_deg / 2) * cos_h;
          const dy_fwd = (length_deg / 2) * sin_h;
          const dx_side = -(width_deg / 2) * sin_h;
          const dy_side = (width_deg / 2) * cos_h;

          const box = [
            [lon + dx_fwd + dx_side, lat + dy_fwd + dy_side],
            [lon + dx_fwd - dx_side, lat + dy_fwd - dy_side],
            [lon - dx_fwd - dx_side, lat - dy_fwd - dy_side],
            [lon - dx_fwd + dx_side, lat - dy_fwd + dy_side],
            [lon + dx_fwd + dx_side, lat + dy_fwd + dy_side]
          ];

          const isLine1 = t.line_id === "line1";
          const trainBaseH = isLine1 ? 20.3 : 14.7;
          const trainH = trainBaseH + 3.8;

          trainPolygons.features.push({
            type: "Feature",
            properties: {
              id: t.id,
              line: t.line_name,
              color: t.color,
              base_height: trainBaseH,
              height: trainH
            },
            geometry: { type: "Polygon", coordinates: [box] }
          });

          // Headlight Point
          const frontLon = lon + dx_fwd * (t.direction >= 0 ? 1 : -1);
          const frontLat = lat + dy_fwd * (t.direction >= 0 ? 1 : -1);

          trainPoints.features.push({
            type: "Feature",
            properties: {
              id: t.id,
              line: t.line_name,
              color: t.color
            },
            geometry: { type: "Point", coordinates: [frontLon, frontLat] }
          });
        });

        if (map.getSource("live-metro-trains-3d")) {
          map.getSource("live-metro-trains-3d").setData(trainPolygons);
        }
        if (map.getSource("live-metro-trains-glow")) {
          map.getSource("live-metro-trains-glow").setData(trainPoints);
        }
      }
    };

    metroAnimFrameId.current = requestAnimationFrame(animateMetroTrains);
    return () => {
      if (metroAnimFrameId.current) cancelAnimationFrame(metroAnimFrameId.current);
    };
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // Ward Labels Layer (BMC Municipal Wards)
  // ──────────────────────────────────────────────────────────────────────────
  const setupWardLabels = (map: any, gis: any, show: boolean) => {
    if (!map || !map.style || !gis || !gis.wards || gis.wards.length === 0) return;
    const isVis = show !== undefined ? show : Boolean(layersRef.current.labels);
    const visStr = isVis ? "visible" : "none";

    const wardsGeoJSON: any = {
      type: "FeatureCollection",
      features: gis.wards.map((w: any) => ({
        type: "Feature",
        properties: {
          code: w.code,
          name: w.name,
          label: `${w.code} - ${w.name}`,
          area: w.area_sqkm,
          density: w.pop_density
        },
        geometry: {
          type: "Point",
          coordinates: [w.lon, w.lat]
        }
      }))
    };

    if (!map.getSource("mumbai-wards")) {
      map.addSource("mumbai-wards", { type: "geojson", data: wardsGeoJSON });

      map.addLayer({
        id: "ward-labels-layer",
        type: "symbol",
        source: "mumbai-wards",
        layout: {
          "visibility": visStr,
          "text-field": ["get", "label"],
          "text-size": 11,
          "text-anchor": "center",
          "text-allow-overlap": false
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "rgba(15, 23, 42, 0.9)",
          "text-halo-width": 2.5
        }
      });
    } else {
      map.getSource("mumbai-wards").setData(wardsGeoJSON);
      if (map.getLayer("ward-labels-layer")) {
        map.setLayoutProperty("ward-labels-layer", "visibility", visStr);
      }
    }
  };

  const setupFlights = (map: any, flightsData: any, show: boolean) => {
    if (!map || !map.style) return;
    ensureCustomIcons(map);
    const isVis = show !== undefined ? show : Boolean(layersRef.current.flights);
    const visStr = isVis ? "visible" : "none";

    const data = (flightsData && flightsData.features && flightsData.features.length > 0)
      ? flightsData
      : { type: "FeatureCollection", features: [] };

    if (!map.getSource("live-flights")) {
      map.addSource("live-flights", { type: "geojson", data });

      map.addLayer({
        id: "live-flights-layer",
        type: "symbol",
        source: "live-flights",
        layout: {
          "icon-image": "plane-icon",
          "icon-size": 0.85,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-rotate": ["get", "heading"],
          "icon-rotation-alignment": "map",
          "icon-pitch-alignment": "map",
          "visibility": visStr
        }
      });

      map.addLayer({
        id: "live-flights-label-layer",
        type: "symbol",
        source: "live-flights",
        layout: {
          "text-field": ["get", "callsign"],
          "text-size": 10.5,
          "text-offset": [0, 1.4],
          "text-anchor": "top",
          "text-allow-overlap": false,
          "text-optional": true,
          "visibility": visStr
        },
        paint: {
          "text-color": "#fbbf24",
          "text-halo-color": "rgba(15, 23, 42, 0.95)",
          "text-halo-width": 2
        }
      });
    } else {
      map.getSource("live-flights").setData(data);
      if (map.getLayer("live-flights-layer")) {
        map.setLayoutProperty("live-flights-layer", "visibility", visStr);
      }
      if (map.getLayer("live-flights-label-layer")) {
        map.setLayoutProperty("live-flights-label-layer", "visibility", visStr);
      }
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Geographic Impact Zone Layer (Disaster Simulation)
  // ──────────────────────────────────────────────────────────────────────────
  const createAsymmetricImpactZone = (center: [number, number], baseRadiusInKm: number, windDirDeg: number, properties: any) => {
    const coords = [];
    // Convert wind direction to radians (adding PI to blow FROM the direction)
    const windRad = (windDirDeg * Math.PI) / 180.0;
    
    const distanceX = baseRadiusInKm / (111.320 * Math.cos((center[1] * Math.PI) / 180));
    const distanceY = baseRadiusInKm / 110.574;

    for (let i = 0; i < 64; i++) {
      const theta = (i / 64) * (2 * Math.PI);
      
      // Procedural Deformation Math:
      // 1. Elongate along the wind direction
      // 2. Add high-frequency noise for jagged, irregular edges
      const directionalBias = Math.cos(theta - windRad) * 0.4; // 40% elongation
      const noise = Math.sin(theta * 5) * 0.05 + Math.cos(theta * 8) * 0.03; // Jaggedness
      
      const deformedRadiusScale = 1.0 + directionalBias + noise;

      const x = distanceX * Math.cos(theta) * deformedRadiusScale;
      const y = distanceY * Math.sin(theta) * deformedRadiusScale;
      
      coords.push([center[0] + x, center[1] + y]);
    }
    coords.push(coords[0]); // Close polygon
    return {
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [coords] },
      properties
    };
  };

  const setupImpactZones = (map: any, disaster: string | null | undefined, result: any) => {
    if (!map || !map.style) return;

    if (!disaster || !result || !result.lat || !result.lon || disaster === "flood") {
      if (map.getLayer("impact-zones-layer")) map.setLayoutProperty("impact-zones-layer", "visibility", "none");
      if (map.getLayer("impact-zones-outline")) map.setLayoutProperty("impact-zones-outline", "visibility", "none");
      return;
    }

    let geojsonData: any = null;
    
    if (result.impact_zones_geojson) {
      geojsonData = result.impact_zones_geojson;
    } else {
      const center = [result.lon, result.lat] as [number, number];
      const windSpeed = result.landfall_wind_kmh || 165;
      const windDir = result.wind_direction_deg || 45; // Default blowing NE
      
      // Calculate radius based on wind speed
      const baseRadius = windSpeed / 12.0; 
  
      // Create 3 concentric, asymmetric zones (Outer = Safe/Green, Mid = Severe/Orange, Inner = Catastrophic/Red)
      const features = [
        createAsymmetricImpactZone(center, baseRadius * 2.5, windDir, { color: "#22c55e", label: "Safe Zone" }),
        createAsymmetricImpactZone(center, baseRadius * 1.5, windDir, { color: "#f97316", label: "Severe Impact" }),
        createAsymmetricImpactZone(center, baseRadius * 0.5, windDir, { color: "#ef4444", label: "Catastrophic Impact" })
      ];
  
      geojsonData = { type: "FeatureCollection", features };
    }

    if (!map.getSource("impact-zones-source")) {
      map.addSource("impact-zones-source", { type: "geojson", data: geojsonData });
      
      map.addLayer({
        id: "impact-zones-layer",
        type: "fill",
        source: "impact-zones-source",
        layout: { visibility: "visible" },
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": 0.15
        }
      },
      // Insert below 3D buildings so it shades the ground, not the roofs
      map.getLayer("ofm-3d-buildings") ? "ofm-3d-buildings" : undefined
      );

      // Add border outlines for the zones
      map.addLayer({
        id: "impact-zones-outline",
        type: "line",
        source: "impact-zones-source",
        layout: { visibility: "visible" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 2,
          "line-dasharray": [4, 4],
          "line-opacity": 0.6
        }
      }, map.getLayer("ofm-3d-buildings") ? "ofm-3d-buildings" : undefined);
      
    } else {
      map.getSource("impact-zones-source").setData(geojsonData);
      map.setLayoutProperty("impact-zones-layer", "visibility", "visible");
      map.setLayoutProperty("impact-zones-outline", "visibility", "visible");
    }
  };

  const setupFloodMap = (map: any, disaster: string | null | undefined, params: any) => {
    if (!map || !map.style) return;

    if (disaster !== "flood" || !params || params.tide_height_m === undefined) {
      if (map.getLayer("floodmap-layer")) {
        try {
          map.removeLayer("floodmap-layer");
          map.removeSource("floodmap-source");
        } catch (e) {}
        if (floodAnimFrameId.current) {
          cancelAnimationFrame(floodAnimFrameId.current);
          floodAnimFrameId.current = 0;
        }
      }
      if (map.getLayer("flood-hotspots-labels")) {
        try {
          map.removeLayer("flood-hotspots-labels");
          map.removeLayer("flood-hotspots-circles");
          map.removeSource("flood-hotspots-source");
        } catch (e) {}
      }
      lastFloodElevRef.current = -1;
      return;
    }

    // Effective elevation combines Tide Surge and rain accumulation with 1 decimal precision
    const rainMm = Number(params.rainfall_mm_hr ?? 120);
    const tideM = Number(params.tide_height_m ?? 4.2);
    const rawElev = tideM + Math.max(0, (rainMm - 20) / 90.0);
    const elev = Number(rawElev.toFixed(1));

    // Dynamic Hotspots GeoJSON with live water depth telemetry
    const hotspots = [
      { name: "Hindmata Flyover (Dadar)", lat: 19.0125, lon: 72.8445, base: 0.45 },
      { name: "Mithi River / Kurla Basin", lat: 19.0700, lon: 72.8700, base: 0.55 },
      { name: "Dharavi Sector 5 Hotspot", lat: 19.0402, lon: 72.8508, base: 0.40 },
      { name: "Milan Subway (Santacruz)", lat: 19.0850, lon: 72.8430, base: 0.50 },
      { name: "Chunabhatti Rail Junction", lat: 19.0550, lon: 72.8750, base: 0.42 },
      { name: "King's Circle / Gandhi Mkt", lat: 19.0300, lon: 72.8580, base: 0.48 }
    ];

    const hotspotFeatures = hotspots.map((h, i) => {
      const calcDepth = Math.max(0.2, (elev * h.base * 0.45) + (rainMm / 120.0) * 0.6);
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [h.lon, h.lat] },
        properties: {
          id: i,
          name: h.name,
          depth: calcDepth.toFixed(1),
          severity: calcDepth > 2.2 ? "CRITICAL" : calcDepth > 1.2 ? "SEVERE" : "WARNING",
          color: calcDepth > 2.2 ? "#ef4444" : calcDepth > 1.2 ? "#f97316" : "#22d3ee"
        }
      };
    });

    const hotspotsGeojson = { type: "FeatureCollection", features: hotspotFeatures };

    if (!map.getSource("flood-hotspots-source")) {
      map.addSource("flood-hotspots-source", { type: "geojson", data: hotspotsGeojson });
      map.addLayer({
        id: "flood-hotspots-circles",
        type: "circle",
        source: "flood-hotspots-source",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 7, 15, 16],
          "circle-color": ["get", "color"],
          "circle-opacity": 0.88,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff"
        }
      });
      map.addLayer({
        id: "flood-hotspots-labels",
        type: "symbol",
        source: "flood-hotspots-source",
        layout: {
          "text-field": ["concat", ["get", "name"], "\nWater Depth: ", ["get", "depth"], "m (", ["get", "severity"], ")"],
          "text-size": 11,
          "text-offset": [0, 1.6],
          "text-anchor": "top",
          "text-allow-overlap": true
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "rgba(15, 23, 42, 0.95)",
          "text-halo-width": 2
        }
      });
    } else {
      map.getSource("flood-hotspots-source").setData(hotspotsGeojson);
    }

    // Debounced Topographic Raster Tile Loading
    const updateRasterTiles = () => {
      if (lastFloodElevRef.current === elev && map.getSource("floodmap-source")) return;
      lastFloodElevRef.current = elev;

      const tileUrl = `${API_BASE}/floodmap/{z}/{x}/{y}?elev=${elev}`;

      if (map.getSource("floodmap-source")) {
        try {
          map.removeLayer("floodmap-layer");
          map.removeSource("floodmap-source");
        } catch (e) {}
      }

      map.addSource("floodmap-source", {
        type: "raster",
        tiles: [tileUrl],
        tileSize: 512,
        bounds: [72.70, 18.85, 73.20, 19.75],
        maxzoom: 14
      });

      const beforeLayer = map.getLayer("ofm-3d-buildings") ? "ofm-3d-buildings" : undefined;
      map.addLayer({
        id: "floodmap-layer",
        type: "raster",
        source: "floodmap-source",
        paint: {
          "raster-opacity": 0.88,
          "raster-fade-duration": 0
        }
      }, beforeLayer);

      if (!floodAnimFrameId.current) {
        const startTime = performance.now();
        const animateFlood = (timestamp: number) => {
          if (!map.getLayer("floodmap-layer")) return;
          const elapsed = timestamp - startTime;
          const opacity = 0.82 + Math.sin(elapsed / 1200) * 0.08;
          const hueRotate = Math.sin(elapsed / 2000) * 10;
          const contrast = 1.0 + Math.sin(elapsed / 800) * 0.15;

          try {
            map.setPaintProperty("floodmap-layer", "raster-opacity", opacity);
            map.setPaintProperty("floodmap-layer", "raster-hue-rotate", hueRotate);
            map.setPaintProperty("floodmap-layer", "raster-contrast", contrast);
          } catch (e) {}

          map.triggerRepaint();
          floodAnimFrameId.current = requestAnimationFrame(animateFlood);
        };
        floodAnimFrameId.current = requestAnimationFrame(animateFlood);
      }
    };

    if (floodDebounceTimerRef.current) clearTimeout(floodDebounceTimerRef.current);
    floodDebounceTimerRef.current = setTimeout(updateRasterTiles, 50);
  };

  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;

    import("mapbox-gl").then((mapboxgl) => {
      if (mapRef.current) return;

      const styleUrl = MAPBOX_STYLES[mapStyle] || MAPBOX_STYLES["dark"];

      const map = new mapboxgl.default.Map({
        container: containerRef.current!,
        style: styleUrl,
        center: [78.9629, 20.5937], // Center of India
        zoom: 3, // Zoomed out to see the whole country
        maxZoom: 22,
        pitch: 0, 
        bearing: 0, 
        antialias: true,
        attributionControl: false
      } as any);

      map.once('style.load', () => {
        // Fly to Mumbai after a short delay so the user sees India first
        setTimeout(() => {
          map.flyTo({
            center: [72.8777, 19.0760], // Mumbai
            zoom: 12,
            pitch: 62,
            bearing: -15,
            duration: 7000, // Smooth 7-second flight
            essential: true
          });
        }, 800);
      });

      map.on('error', (e: any) => {
        const msg = String(e?.error?.message || e?.message || e || "");
        if (msg.includes("404") || msg.includes("glyph") || msg.includes("sprite") || msg.includes("not found")) {
          console.warn("Map resource notice:", msg);
          return;
        }
        console.error("MapLibre Error:", e.error || e);
      });

      mapRef.current = map;

      map.addControl(
        new mapboxgl.default.NavigationControl({ visualizePitch: true }),
        "top-right"
      );

      map.on("load", () => {
        if (map.getTerrain()) {
          map.setTerrain(null);
        }
        ensureCustomIcons(map);

        // Setup all layers reading from authoritative state refs
        setup3DBuildings(map, mapStyleRef.current, Boolean(layersRef.current.buildings));
        setupTraffic(map, trafficRef.current, Boolean(layersRef.current.traffic));
        setupAQI(map, aqiRef.current, Boolean(layersRef.current.aqi));
        setupRailways(map, gisDataRef.current, trainsRef.current, Boolean(layersRef.current.railways));
        setupMetros(map, gisDataRef.current, Boolean(layersRef.current.metros));
        setupWardLabels(map, gisDataRef.current, Boolean(layersRef.current.labels));
        setupFlights(map, flightsRef.current, Boolean(layersRef.current.flights));
        setupImpactZones(map, activeDisaster, simulationResult);
        
        syncAllLayerVisibilities(map);
        
        if (onMapLoad) {
          onMapLoad(map);
        }
      });

      // ──────────────────────────────────────────────────────────────────────────
      // Train Hover Popup Logic
      // ──────────────────────────────────────────────────────────────────────────
      const trainPopup = new mapboxgl.default.Popup({
        closeButton: false,
        closeOnClick: false,
        className: 'train-popup'
      });

      map.on('mouseenter', 'live-trains-layer', (e: any) => {
        map.getCanvas().style.cursor = 'pointer';
        
        if (e.features.length > 0) {
          const coordinates = e.features[0].geometry.coordinates.slice();
          const props = e.features[0].properties;
          
          while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
            coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
          }

          const isGps = props.live_source === 'yatri_gps';
          const sourceBadge = isGps
            ? '<span class="live-badge" style="font-size: 9px; padding: 3px 6px; border-radius: 4px; background: #059669; color: #ffffff; font-weight: 800; letter-spacing: 0.5px;">🟢 LIVE GPS</span>'
            : '<span style="font-size: 9px; padding: 3px 6px; border-radius: 4px; background: #64748b; color: #ffffff; font-weight: 800; letter-spacing: 0.5px;">📅 SCHEDULED</span>';
          
          // Premium Sleek Dark Mode Redesign
          const primaryStatus = props.status_text || props.status || "Unknown";
          
          let gpsInfo = '';
          if (isGps) {
            const trainStatus = props.train_status === 1 ? 'At Station' : props.train_status === 0 ? 'Running' : 'Unknown';
            const accuracy = props.train_accuracy === 0 ? 'High' : props.train_accuracy === 1 ? 'Medium' : 'Low';
            const yatriLiveStatus = props.yatri_live_status ? `<div style="color: #10b981; font-weight: 500; font-size: 11px; margin-top: 4px;">${props.yatri_live_status}</div>` : '';
            
            let fixAge = '';
            if (props.live_time) {
              try {
                const fixDate = new Date(props.live_time.replace(' ', 'T') + '+05:30');
                const ageSec = Math.round((Date.now() - fixDate.getTime()) / 1000);
                fixAge = ageSec < 60 ? `${ageSec}s ago` : `${Math.round(ageSec / 60)}m ago`;
              } catch { fixAge = ''; }
            }

            gpsInfo = `
              <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="font-size: 9px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Telemetry</div>
                    ${sourceBadge}
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: #cbd5e1; margin-bottom: 4px;">
                  <span>State</span><span style="font-weight: 500; color: #f8fafc;">${trainStatus}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: #cbd5e1; margin-bottom: 4px;">
                  <span>Accuracy</span><span style="font-weight: 500; color: #f8fafc;">${accuracy}</span>
                </div>
                ${fixAge ? `<div style="display: flex; justify-content: space-between; font-size: 11px; color: #cbd5e1;">
                  <span>Last Fix</span><span style="font-weight: 500; color: #f8fafc;">${fixAge}</span>
                </div>` : ''}
              </div>
            `;
          }
          
          // CSS animations string to inject if not already present globally
          const pulseAnimation = `
            <style>
              @keyframes neon-pulse {
                0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
                70% { box-shadow: 0 0 0 4px rgba(16, 185, 129, 0); }
                100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
              }
              .live-badge { animation: neon-pulse 2s infinite; }
              .dark-popup-container {
                 background: #0f172a;
                 border: 1px solid rgba(255, 255, 255, 0.1);
                 box-shadow: 0 15px 30px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05);
                 border-radius: 12px;
                 padding: 14px;
                 font-family: 'Inter', sans-serif;
                 min-width: 220px;
                 color: #f8fafc;
              }
              .maplibregl-popup-content {
                 background: transparent !important;
                 padding: 0 !important;
                 box-shadow: none !important;
              }
              .maplibregl-popup-tip {
                 border-top-color: #0f172a !important;
              }
            </style>
          `;

          const html = `
            ${pulseAnimation}
            <div class="dark-popup-container">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                <span style="font-weight: 700; font-size: 14px; color: #f8fafc; display: flex; align-items: center; gap: 6px;">
                  <span style="font-size: 16px;">🚆</span> ${props.id}
                </span>
              </div>
              
              <div style="background: rgba(255,255,255,0.03); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                  <div style="font-size: 13px; font-weight: 600; color: #f8fafc; margin-bottom: 2px;">${primaryStatus}</div>
                  ${props.yatri_live_status ? `<div style="color: #10b981; font-weight: 500; font-size: 11px; margin-bottom: 8px;">${props.yatri_live_status}</div>` : ''}
                  
                  <div style="font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; margin-top: 8px; align-items: center;">
                      <span>Next <span style="font-weight: 500; color: #cbd5e1; margin-left: 4px;">${props.next_station}</span></span>
                      <span style="font-family: monospace; font-size: 12px; font-weight: 500; color: #e2e8f0; background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px;">${props.next_time}</span>
                  </div>
              </div>
              
              ${gpsInfo}
              
              <div style="margin-top: 12px; display: flex; justify-content: center;">
                 <div style="font-size: 9px; padding: 4px 8px; border-radius: 4px; display: inline-block; background-color: ${props.color}20; color: ${props.color}; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; border: 1px solid ${props.color}40;">${props.line} LINE</div>
              </div>
            </div>
          `;
          
          trainPopup.setLngLat(coordinates).setHTML(html).addTo(map);
        }
      });

      map.on('mouseleave', 'live-trains-layer', () => {
        map.getCanvas().style.cursor = '';
        trainPopup.remove();
      });
      
      // Flight Hover Popup Logic
      const flightPopup = new mapboxgl.default.Popup({
        closeButton: false,
        closeOnClick: false,
        className: 'flight-popup'
      });

      const buildFlightPopupHTML = (p: any) => {
        const photoSrc = p.photo_url || `${API_BASE}/flights/photo/${encodeURIComponent(p.reg || p.id || p.callsign)}`;
        const callsign = p.callsign || 'Flight';
        const reg = p.reg || p.id || '';
        const model = p.model || 'Commercial Jetliner';
        const airlineInfo = p.country || p.airline || 'Commercial Airline';
        const altM = Math.round(p.altitude_m || 0);
        const altFt = Math.round(altM * 3.28084);
        const speedKmh = Math.round((p.velocity_ms || 0) * 3.6);
        const heading = Math.round(p.heading || 0);

        return `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 0px; min-width: 220px; overflow: hidden; border-radius: 8px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.4); background: #ffffff;">
            <div style="width: 100%; height: 110px; background-color: #0f172a; position: relative; overflow: hidden; border-bottom: 2px solid #0284c7;">
              <img src="${photoSrc}" alt="${callsign}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.src='https://t.plnspttrs.net/22530/1445721_1a8784e0f8_280.jpg';" />
              <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(to top, rgba(15,23,42,0.85), transparent); height: 28px;"></div>
              <div style="position: absolute; bottom: 3px; right: 6px; font-size: 8px; color: rgba(255,255,255,0.7); background: rgba(0,0,0,0.5); padding: 1px 4px; border-radius: 3px;">Planespotters.net</div>
            </div>
            <div style="padding: 10px 12px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px;">
                <span style="font-weight: 800; color: #0f172a; font-size: 15px; letter-spacing: -0.01em;">${callsign}</span>
                <span style="font-size: 10px; background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-family: monospace;">${reg}</span>
              </div>
              <div style="font-size: 11px; font-weight: 700; color: #0284c7; margin-bottom: 2px;">
                ${model}
              </div>
              <div style="font-size: 11px; color: #64748b; margin-bottom: 8px;">
                ${airlineInfo}
              </div>
              <div style="font-size: 11px; color: #475569; display: flex; flex-direction: column; gap: 4px; border-top: 1px solid #f1f5f9; padding-top: 6px;">
                <div style="display: flex; justify-content: space-between;">
                  <span>Altitude:</span>
                  <span style="color: #0f172a; font-weight: 600;">${altM} m (${altFt} ft)</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span>Speed:</span>
                  <span style="color: #0f172a; font-weight: 600;">${speedKmh} km/h</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span>Heading:</span>
                  <span style="color: #0f172a; font-weight: 600;">${heading}°</span>
                </div>
              </div>
            </div>
          </div>
        `;
      };

      map.on('mouseenter', 'live-flights-layer', (e: any) => {
        map.getCanvas().style.cursor = 'pointer';
        const coordinates = e.features[0].geometry.coordinates.slice();
        const p = e.features[0].properties;
        flightPopup.setLngLat(coordinates).setHTML(buildFlightPopupHTML(p)).addTo(map);
      });

      map.on('mouseleave', 'live-flights-layer', () => {
        map.getCanvas().style.cursor = '';
        flightPopup.remove();
      });

      map.on('mouseenter', 'live-flights-label-layer', (e: any) => {
        map.getCanvas().style.cursor = 'pointer';
        const coordinates = e.features[0].geometry.coordinates.slice();
        const p = e.features[0].properties;
        flightPopup.setLngLat(coordinates).setHTML(buildFlightPopupHTML(p)).addTo(map);
      });

      map.on('mouseleave', 'live-flights-label-layer', () => {
        map.getCanvas().style.cursor = '';
        flightPopup.remove();
      });

      // AQI Station Hover Popup Logic
      const aqiPopup = new mapboxgl.default.Popup({
        closeButton: false,
        closeOnClick: false,
        className: 'aqi-station-popup',
        offset: 14
      });

      map.on('mouseenter', 'aqi-coverage-circles', (e: any) => {
        map.getCanvas().style.cursor = 'pointer';
        if (!e.features || e.features.length === 0) return;
        const coordinates = e.features[0].geometry.coordinates.slice();
        const p = e.features[0].properties;

        const aqiVal = Number(p.aqi);
        let badgeColor = "#22c55e"; // Good
        let category = p.category || "Satisfactory";
        if (aqiVal > 300) { badgeColor = "#a855f7"; category = "Severe"; }
        else if (aqiVal > 200) { badgeColor = "#ef4444"; category = "Poor"; }
        else if (aqiVal > 100) { badgeColor = "#f97316"; category = "Moderate"; }
        else if (aqiVal > 50) { badgeColor = "#eab308"; category = "Satisfactory"; }

        const html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 12px; min-width: 195px; background: rgba(15, 23, 42, 0.94); backdrop-filter: blur(14px); border: 1px solid rgba(255,255,255,0.18); border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.6); color: #ffffff;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; gap: 8px;">
              <span style="font-weight: 700; font-size: 13px; color: #f8fafc; letter-spacing: 0.2px;">${p.name}</span>
              <span style="font-size: 9px; padding: 2px 7px; border-radius: 9999px; background: ${badgeColor}25; color: ${badgeColor}; border: 1px solid ${badgeColor}60; font-weight: 700; text-transform: uppercase;">${category}</span>
            </div>
            <div style="display: flex; align-items: baseline; gap: 6px; margin-bottom: 10px;">
              <span style="font-size: 28px; font-weight: 800; color: ${badgeColor}; line-height: 1;">${aqiVal}</span>
              <span style="font-size: 11px; font-weight: 500; color: #94a3b8;">US AQI • Realtime</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 11px;">
              <div style="background: rgba(255,255,255,0.05); padding: 5px 8px; border-radius: 6px;">
                <span style="color: #94a3b8; display: block; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px;">PM2.5</span>
                <span style="color: #f1f5f9; font-weight: 600;">${p.pm2_5 || 12} µg/m³</span>
              </div>
              <div style="background: rgba(255,255,255,0.05); padding: 5px 8px; border-radius: 6px;">
                <span style="color: #94a3b8; display: block; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px;">PM10</span>
                <span style="color: #f1f5f9; font-weight: 600;">${p.pm10 || 25} µg/m³</span>
              </div>
            </div>
          </div>
        `;

        aqiPopup.setLngLat(coordinates).setHTML(html).addTo(map);
      });

      // ──────────────────────────────────────────────────────────────────────────
      // Metro Station & Track Interactive Popup Logic
      // ──────────────────────────────────────────────────────────────────────────
      const metroPopup = new mapboxgl.default.Popup({
        closeButton: true,
        closeOnClick: true,
        className: 'metro-popup'
      });

      map.on('mouseenter', 'metro-stations-core-layer', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'metro-stations-core-layer', () => {
        map.getCanvas().style.cursor = '';
      });

      map.on('click', 'metro-stations-core-layer', (e: any) => {
        if (e.features && e.features.length > 0) {
          const coordinates = e.features[0].geometry.coordinates.slice();
          const props = e.features[0].properties;
          
          while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
            coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
          }

          const isOperational = props.status === 'Operational';
          const statusBadge = isOperational
            ? '<span style="font-size: 9px; padding: 2px 7px; border-radius: 9999px; background: rgba(16, 185, 129, 0.2); color: #10b981; font-weight: 700; border: 1px solid rgba(16, 185, 129, 0.4);">● OPERATIONAL</span>'
            : '<span style="font-size: 9px; padding: 2px 7px; border-radius: 9999px; background: rgba(245, 158, 11, 0.2); color: #f59e0b; font-weight: 700; border: 1px solid rgba(245, 158, 11, 0.4);">⚙ UNDER CONSTRUCTION</span>';

          const interchangeInfo = props.interchange && props.interchange !== 'None'
            ? `<div style="margin-top: 8px; padding: 8px 10px; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
                 <div style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; font-weight: 700;">Interchange Connect</div>
                 <div style="font-size: 11px; font-weight: 600; color: #f8fafc; margin-top: 2px;">⇄ ${props.interchange}</div>
               </div>`
            : '';

          const html = `
            <div style="background: rgba(15, 23, 42, 0.96); backdrop-filter: blur(14px); border: 1px solid rgba(255, 255, 255, 0.16); box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.7); border-radius: 12px; padding: 14px; font-family: Inter, sans-serif; min-width: 230px; color: #f8fafc;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 8px;">
                <div style="font-size: 10px; padding: 3px 8px; border-radius: 6px; background-color: ${props.color}25; color: ${props.color}; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid ${props.color}60;">
                  ${props.short_name || props.line}
                </div>
                ${statusBadge}
              </div>
              <div style="font-size: 16px; font-weight: 800; color: #ffffff; letter-spacing: -0.2px; margin-top: 4px;">
                🚇 ${props.name}
              </div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">
                Mumbai Metro Transit Station
              </div>
              ${interchangeInfo}
              <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 10px; font-family: monospace; color: #64748b; display: flex; justify-content: space-between;">
                <span>GPS: ${coordinates[1].toFixed(4)}°, ${coordinates[0].toFixed(4)}°</span>
                <span style="color: ${props.color}; font-weight: 700;">3D ELEVATED</span>
              </div>
            </div>
          `;

          metroPopup.setLngLat(coordinates).setHTML(html).addTo(map);
        }
      });

      map.on("click", (e) => {
        onMapClick(e.lngLat.lat, e.lngLat.lng);
      });
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // Handle Dynamic Map Style Switching
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    mapStyleRef.current = mapStyle;
    const map = mapRef.current;
    if (!map) return;

    if (map.getTerrain()) {
      map.setTerrain(null);
    }

    setTimeout(() => {
      if (!mapRef.current) return;
      
      map.once("style.load", () => {
        if (!mapRef.current) return;
        if (mapRef.current.getTerrain()) {
          mapRef.current.setTerrain(null);
        }
        ensureCustomIcons(mapRef.current);
        setup3DBuildings(mapRef.current, mapStyle, Boolean(layersRef.current.buildings));
        setupTraffic(mapRef.current, trafficRef.current, Boolean(layersRef.current.traffic));
        setupAQI(mapRef.current, aqiRef.current, Boolean(layersRef.current.aqi));
        setupRailways(mapRef.current, gisDataRef.current, trainsRef.current, Boolean(layersRef.current.railways));
        setupMetros(mapRef.current, gisDataRef.current, Boolean(layersRef.current.metros));
        setupWardLabels(mapRef.current, gisDataRef.current, Boolean(layersRef.current.labels));
        setupFlights(mapRef.current, flightsRef.current, Boolean(layersRef.current.flights));
        setupImpactZones(mapRef.current, activeDisaster, simulationResult);
        syncAllLayerVisibilities(mapRef.current);
      });

      const styleUrl = MAPBOX_STYLES[mapStyle] || MAPBOX_STYLES["dark"];
      map.setStyle(styleUrl as any);
    }, 50);
  }, [mapStyle]);

  // ──────────────────────────────────────────────────────────────────────────
  // External Telemetry & Data Change Listeners
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    gisDataRef.current = gisData;
    const map = mapRef.current;
    if (!map || !gisData || !map.style) return;
    setupRailways(map, gisData, trainsRef.current, Boolean(layersRef.current.railways));
    setupMetros(map, gisData, Boolean(layersRef.current.metros));
    setupWardLabels(map, gisData, Boolean(layersRef.current.labels));
    syncAllLayerVisibilities(map);
  }, [gisData]);

  useEffect(() => {
    trainsRef.current = trains;
    const map = mapRef.current;
    if (!map || !map.style || !gisDataRef.current) return;
    setupRailways(map, gisDataRef.current, trains, Boolean(layersRef.current.railways));
  }, [trains]);

  useEffect(() => {
    flightsRef.current = flights;
    const map = mapRef.current;
    if (!map || !map.style) return;
    setupFlights(map, flights, Boolean(layersRef.current.flights));
  }, [flights]);

  useEffect(() => {
    trafficRef.current = traffic;
    const map = mapRef.current;
    if (!map || !map.style || !traffic) return;
    setupTraffic(map, traffic, Boolean(layersRef.current.traffic));
  }, [traffic]);

  useEffect(() => {
    aqiRef.current = aqi;
    const map = mapRef.current;
    if (!map || !map.style || !aqi) return;
    setupAQI(map, aqi, Boolean(layersRef.current.aqi));
  }, [aqi]);

  // Sync Disaster Impact Zones when simulation results or active disaster changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.style) return;
    setupImpactZones(map, activeDisaster, simulationResult);
    setupFloodMap(map, activeDisaster, simulationParams);
  }, [activeDisaster, simulationResult, simulationParams, mapStyle]);

  // ──────────────────────────────────────────────────────────────────────────
  // Instant Authoritative Layer Visibility Sync
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    layersRef.current = layers;
    const map = mapRef.current;
    if (!map || !map.style) return;

    // Lazily construct any layer if user turned it ON and it does not yet exist
    if (layers.buildings && !map.getLayer("ofm-3d-buildings")) {
      setup3DBuildings(map, mapStyleRef.current, true);
    }
    if (layers.traffic && trafficRef.current && !map.getLayer("ofm-traffic-overlay")) {
      setupTraffic(map, trafficRef.current, true);
    }
    if (layers.railways && gisDataRef.current && !map.getSource("railway-tracks")) {
      setupRailways(map, gisDataRef.current, trainsRef.current, true);
    }
    if (layers.metros && gisDataRef.current && !map.getSource("metro-tracks")) {
      setupMetros(map, gisDataRef.current, true);
    }
    if (layers.flights && flightsRef.current && !map.getSource("live-flights")) {
      setupFlights(map, flightsRef.current, true);
    }
    if (layers.aqi && aqiRef.current && !map.getSource("aqi-source")) {
      setupAQI(map, aqiRef.current, true);
    }
    if (layers.labels && gisDataRef.current && !map.getSource("mumbai-wards")) {
      setupWardLabels(map, gisDataRef.current, true);
    }

    syncAllLayerVisibilities(map);
  }, [layers]);

  // ──────────────────────────────────────────────────────────────────────────
  // Camera FlyTo on location selection
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedLocation) return;

    map.flyTo({
      center: [selectedLocation.lon, selectedLocation.lat],
      zoom: 15.8,
      pitch: 64,
      bearing: 25,
      duration: 1800,
      essential: true
    });

    // Epicenter Target Marker
    import("mapbox-gl").then((mapboxgl) => {
      if (markerRef.current) markerRef.current.remove();

      const el = document.createElement("div");
      el.className =
        "relative flex items-center justify-center w-9 h-9 cursor-pointer";
      el.innerHTML = `
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
        <span class="relative inline-flex rounded-full h-5 w-5 bg-blue-600 border-2 border-white shadow-lg"></span>
      `;

      const popup = new mapboxgl.default.Popup({ offset: 25 }).setHTML(`
        <div class="p-1.5 font-sans text-slate-900">
          <strong class="text-blue-600 block text-sm font-bold">${selectedLocation.name}</strong>
          <span class="text-xs text-slate-600 font-mono">Lat: ${selectedLocation.lat.toFixed(4)}, Lon: ${selectedLocation.lon.toFixed(4)}</span>
        </div>
      `);

      markerRef.current = new mapboxgl.default.Marker({ element: el })
        .setLngLat([selectedLocation.lon, selectedLocation.lat])
        .setPopup(popup)
        .addTo(map);

      markerRef.current.togglePopup();
    });
  }, [selectedLocation]);

  return (
    <div className="absolute inset-0 w-full h-full bg-[#0f172a] overflow-hidden">
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
};
