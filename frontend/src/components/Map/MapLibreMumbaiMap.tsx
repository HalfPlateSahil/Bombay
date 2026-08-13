"use client";

import React, { useEffect, useRef } from "react";
import { TrafficData, AQIData } from "../../types";
import "maplibre-gl/dist/maplibre-gl.css";

export type MapStyleType = "liberty" | "dark" | "satellite" | "bright" | "positron";

interface MapLibreMumbaiMapProps {
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
  onMapClick: (lat: number, lon: number) => void;
  onMapLoad?: (map: any) => void;
}

// All OpenFreeMap official style URLs
// Docs: https://openfreemap.org/quick_start/
const OPENFREEMAP_STYLE_URLS: Record<string, string | object> = {
  liberty: "https://tiles.openfreemap.org/styles/liberty",
  bright: "https://tiles.openfreemap.org/styles/bright",
  dark: "https://tiles.openfreemap.org/styles/dark",
  positron: "https://tiles.openfreemap.org/styles/positron",
  // Satellite falls back to ESRI raster tiles (OpenFreeMap does not have satellite)
  satellite: {
    version: 8,
    sources: {
      "esri-satellite": {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        ],
        tileSize: 256,
        attribution: "&copy; Esri &copy; OpenStreetMap"
      }
    },
    layers: [
      {
        id: "satellite-layer",
        type: "raster",
        source: "esri-satellite",
        minzoom: 0,
        maxzoom: 18
      }
    ]
  }
};

// Determine if a style is dark-themed for color selection
const isDarkStyle = (style: MapStyleType) => style === "dark";

export const MapLibreMumbaiMap: React.FC<MapLibreMumbaiMapProps> = ({
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
  onMapClick,
  onMapLoad
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  
  // Flight Animation Refs
  const flightDataRef = useRef<any>(null);
  const lastFlightFrameTime = useRef<number>(0);
  const flightAnimFrameId = useRef<number>(0);
  const markerRef = useRef<any>(null);

  // Train Animation Refs
  const trainDataRef = useRef<any>(null);
  const lastTrainFrameTime = useRef<number>(0);
  const trainAnimFrameId = useRef<number>(0);

  // ──────────────────────────────────────────────────────────────────────────
  // 3D Building Engine — Uses OpenFreeMap's native openmaptiles vector source
  // The building source-layer has: render_height, render_min_height, height,
  // min_height fields from OpenStreetMap data via OpenMapTiles schema.
  // ──────────────────────────────────────────────────────────────────────────
  const setup3DBuildings = (map: any, style: MapStyleType, show: boolean) => {
    if (!map) return;

    // Wait until style is fully loaded before modifying layers
    if (!map.isStyleLoaded()) {
      map.once("style.load", () => setup3DBuildings(map, style, show));
      return;
    }

    const dark = isDarkStyle(style);

    // Satellite mode has no vector building source — skip
    if (style === "satellite") return;

    // ── Strategy 1: Enhance the existing building-3d layer from Liberty/Bright styles ──
    // OpenFreeMap liberty & bright styles already include a "building-3d" layer
    if (map.getLayer("building-3d")) {
      try {
        map.setLayerZoomRange("building-3d", 13, 22);
        map.setPaintProperty("building-3d", "fill-extrusion-height", [
          "coalesce",
          ["get", "render_height"],
          ["get", "height"],
          15
        ]);
        map.setPaintProperty("building-3d", "fill-extrusion-base", [
          "coalesce",
          ["get", "render_min_height"],
          ["get", "min_height"],
          0
        ]);
        map.setPaintProperty("building-3d", "fill-extrusion-color", [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "render_height"], ["get", "height"], 15],
          0,  dark ? "#0e7490" : "#cbd5e1",
          20, dark ? "#0891b2" : "#94a3b8",
          50, dark ? "#06b6d4" : "#64748b",
          100, dark ? "#22d3ee" : "#475569",
          200, dark ? "#67e8f9" : "#334155"
        ]);
        map.setPaintProperty("building-3d", "fill-extrusion-opacity", show ? 0.85 : 0);
        map.setLayoutProperty("building-3d", "visibility", show ? "visible" : "none");
      } catch (e) {
        console.warn("[OpenFreeMap 3D] building-3d layer update:", e);
      }
      return;
    }

    // ── Strategy 2: Add a new 3D extrusion layer from openmaptiles source ──
    // For styles (e.g. dark, positron) that don't already have building-3d
    const CUSTOM_LAYER_ID = "ofm-3d-buildings";

    // Find the OpenFreeMap vector source — it's typically named "openmaptiles"
    const sources = map.getStyle()?.sources || {};
    let vectorSourceId: string | null = null;
    for (const [id, src] of Object.entries(sources) as [string, any][]) {
      if (src.type === "vector") {
        vectorSourceId = id;
        break;
      }
    }

    if (!vectorSourceId) {
      console.warn("[OpenFreeMap 3D] No vector source found in style — cannot add 3D buildings");
      return;
    }

    if (map.getLayer(CUSTOM_LAYER_ID)) {
      // Layer exists — just toggle visibility and update colors
      try {
        map.setLayoutProperty(CUSTOM_LAYER_ID, "visibility", show ? "visible" : "none");
        map.setPaintProperty(CUSTOM_LAYER_ID, "fill-extrusion-color", [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "render_height"], ["get", "height"], 15],
          0,  dark ? "#0e7490" : "#cbd5e1",
          20, dark ? "#0891b2" : "#94a3b8",
          50, dark ? "#06b6d4" : "#64748b",
          100, dark ? "#22d3ee" : "#475569",
          200, dark ? "#67e8f9" : "#334155"
        ]);
      } catch (e) {
        console.warn("[OpenFreeMap 3D] layer update:", e);
      }
    } else {
      // Create a new fill-extrusion layer using the vector source's "building" layer
      try {
        // Find the first symbol layer to insert buildings below labels
        const styleLayers = map.getStyle()?.layers || [];
        let labelLayerId: string | undefined;
        for (const layer of styleLayers) {
          if (layer.type === "symbol" && layer.layout?.["text-field"]) {
            labelLayerId = layer.id;
            break;
          }
        }

        map.addLayer(
          {
            id: CUSTOM_LAYER_ID,
            type: "fill-extrusion",
            source: vectorSourceId,
            "source-layer": "building",
            minzoom: 13,
            layout: {
              visibility: show ? "visible" : "none"
            },
            paint: {
              "fill-extrusion-color": [
                "interpolate",
                ["linear"],
                ["coalesce", ["get", "render_height"], ["get", "height"], 15],
                0,  dark ? "#0e7490" : "#cbd5e1",
                20, dark ? "#0891b2" : "#94a3b8",
                50, dark ? "#06b6d4" : "#64748b",
                100, dark ? "#22d3ee" : "#475569",
                200, dark ? "#67e8f9" : "#334155"
              ],
              "fill-extrusion-height": [
                "coalesce",
                ["get", "render_height"],
                ["get", "height"],
                15
              ],
              "fill-extrusion-base": [
                "coalesce",
                ["get", "render_min_height"],
                ["get", "min_height"],
                0
              ],
              "fill-extrusion-opacity": 0.85,
              "fill-extrusion-vertical-gradient": true
            }
          },
          labelLayerId // Insert below labels for clean rendering
        );
      } catch (e) {
        console.warn("[OpenFreeMap 3D] layer creation:", e);
      }
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Procedural Traffic Overlay Layer
  // ──────────────────────────────────────────────────────────────────────────
  const setupTraffic = (map: any, trData: TrafficData | null, show: boolean) => {
    if (!map || !trData) return;

    if (!map.isStyleLoaded()) {
      map.once("style.load", () => setupTraffic(map, trData, show));
      return;
    }

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
        source: "openmaptiles",
        "source-layer": "transportation",
        // Only show traffic on significant arterial roads
        filter: ["in", "class", "motorway", "trunk", "primary", "secondary"],
        layout: {
          "line-join": "round",
          "line-cap": "round",
          visibility: show ? "visible" : "none"
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
        show ? "visible" : "none"
      );
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // AQI Heatmap Layer
  // ──────────────────────────────────────────────────────────────────────────
  const setupAQI = (map: any, aqiData: AQIData | null, show: boolean) => {
    if (!map || !aqiData || !aqiData.stations) return;

    if (!map.isStyleLoaded()) {
      map.once("style.load", () => setupAQI(map, aqiData, show));
      return;
    }

    const aqiGeoJSON: any = {
      type: "FeatureCollection",
      features: aqiData.stations.map((st) => ({
        type: "Feature",
        properties: {
          aqi: st.aqi,
          name: st.name
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

    // Cleanup old heatmap layer if transitioning during hot-reload
    if (map.getLayer("aqi-heatmap")) {
      map.removeLayer("aqi-heatmap");
    }

    // 1. Solid Badge Layer for Distinct Stations
    if (!map.getLayer("aqi-coverage-circles")) {
      map.addLayer({
        id: "aqi-coverage-circles",
        type: "circle",
        source: "aqi-source",
        layout: {
          visibility: show ? "visible" : "none"
        },
        paint: {
          // Sharp solid circle with a white border to mimic professional AQI markers
          "circle-blur": 0,
          "circle-opacity": 0.95,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
          // Consistent radius for badges
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10, 12,
            14, 16,
            18, 22
          ],
          // Standardized AQI color mapping
          "circle-color": [
            "step",
            ["get", "aqi"],
            "#a3e635",    // 0-50: Good (Light Green)
            51, "#facc15",  // 51-100: Satisfactory (Yellow)
            101, "#f97316", // 101-200: Moderate (Orange)
            201, "#ef4444", // 201-300: Poor (Red)
            301, "#991b1b"  // 301+: Severe (Dark Red)
          ]
        }
      },
      // Insert above buildings for clear visibility
      undefined
      );
    } else {
      map.setLayoutProperty("aqi-coverage-circles", "visibility", show ? "visible" : "none");
    }

    // 2. Exact Value Symbol Layer (Numbers inside the badge)
    if (!map.getLayer("aqi-value-labels")) {
      map.addLayer({
        id: "aqi-value-labels",
        type: "symbol",
        source: "aqi-source",
        layout: {
          visibility: show ? "visible" : "none",
          // Only show the number, exactly centered in the circle
          "text-field": ["to-string", ["get", "aqi"]],
          "text-font": ["Noto Sans Bold"],
          "text-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10, 9,
            14, 12,
            18, 16
          ],
          "text-offset": [0, 0],
          "text-anchor": "center",
          "text-allow-overlap": true
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "rgba(0,0,0,0.3)",
          "text-halo-width": 1
        }
      },
      // Insert above buildings for clear visibility
      map.getLayer("ofm-3d-buildings") ? "ofm-3d-buildings" : undefined
    );
    } else {
      map.setLayoutProperty("aqi-value-labels", "visibility", show ? "visible" : "none");
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Procedural Train Simulation Layer
  // ──────────────────────────────────────────────────────────────────────────
  const setupRailways = (map: any, gisData: any, trainsData: any, show: boolean) => {
    if (!map || !gisData || !gisData.railways) return;

    if (!map.isStyleLoaded()) {
      map.once("style.load", () => setupRailways(map, gisData, trainsData, show));
      return;
    }

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
          visibility: show ? "visible" : "none"
        },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 6,
          "line-opacity": 0.6
        }
      });
    } else {
      map.getSource("railway-tracks").setData(tracksGeoJSON);
      map.setLayoutProperty("railway-tracks-layer", "visibility", show ? "visible" : "none");
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
        layout: { visibility: show ? "visible" : "none" },
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
          "visibility": show ? "visible" : "none",
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
      map.setLayoutProperty("railway-stations-layer", "visibility", show ? "visible" : "none");
      if (map.getLayer("railway-stations-label-layer")) {
        map.setLayoutProperty("railway-stations-label-layer", "visibility", show ? "visible" : "none");
      }
    }

    // 3. Setup Live Trains
    if (trainsData && trainsData.features && trainsData.features.length > 0) {
      if (!map.getSource("live-trains")) {
        map.addSource("live-trains", { type: "geojson", data: trainsData });

        try {
          // Reliable 3D Extrusion Fallback across all MapLibre versions
          if (!map.getSource("live-trains-3d")) {
            map.addSource("live-trains-3d", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          }

          if (!map.getLayer("live-trains-3d-layer")) {
            map.addLayer({
              id: "live-trains-3d-layer",
              type: "fill-extrusion",
              source: "live-trains-3d",
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
        if (map.getLayer("live-trains-bg-layer")) map.setLayoutProperty("live-trains-bg-layer", "visibility", show ? "visible" : "none");
        if (map.getLayer("live-trains-layer")) map.setLayoutProperty("live-trains-layer", "visibility", show ? "visible" : "none");
        if (map.getLayer("live-trains-3d-layer")) map.setLayoutProperty("live-trains-3d-layer", "visibility", show ? "visible" : "none");
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
            // Store the incoming real coordinate as the server target
            const serverCoords = nf.geometry.coordinates;
            // But visually start from where the train currently is
            nf.geometry.coordinates = [...existing.geometry.coordinates]; 
            nf.properties.serverCoords = serverCoords;
            nf.properties.lastUpdateTime = Date.now();
          } else {
            nf.properties.serverCoords = [...nf.geometry.coordinates];
            nf.properties.lastUpdateTime = Date.now();
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
      if (!map || !map.isStyleLoaded() || !map.getSource("live-trains") || !trainDataRef.current) {
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
          
          // Physics-based Dead-Reckoning Animation
          if (p.serverCoords) {
             const tCoords = p.serverCoords;
             const cCoords = coords;
             
             if (p.status === "At Station") {
                 // Gently glide into the station
                 const lerpFactor = Math.min(1.0, dt * 3.0); 
                 const nLon = cCoords[0] + (tCoords[0] - cCoords[0]) * lerpFactor;
                 const nLat = cCoords[1] + (tCoords[1] - cCoords[1]) * lerpFactor;
                 if (Math.abs(nLon - cCoords[0]) > 0.000001 || Math.abs(nLat - cCoords[1]) > 0.000001) {
                    f.geometry.coordinates = [nLon, nLat];
                    changed = true;
                 }
             } else if (p.velocity_ms > 0 && p.heading !== undefined) {
                 // DEAD-RECKONING: Move the train along its heading at its velocity
                 // This makes trains feel alive between 8s server updates
                 const speed = p.velocity_ms; // meters per second
                 const headingRad = (p.heading * Math.PI) / 180.0;
                 
                 // Convert m/s movement to degrees
                 const metersPerDegreeLat = 111320.0;
                 const metersPerDegreeLon = 111320.0 * Math.cos(cCoords[1] * Math.PI / 180.0);
                 
                 const dLon = (speed * dt * Math.sin(headingRad)) / metersPerDegreeLon;
                 const dLat = (speed * dt * Math.cos(headingRad)) / metersPerDegreeLat;
                 
                 // Dead-reckoned position
                 let drLon = cCoords[0] + dLon;
                 let drLat = cCoords[1] + dLat;
                 
                 // Blend with server correction: gently pull towards server target
                 // This prevents cumulative drift from dead-reckoning errors
                 const errLon = tCoords[0] - drLon;
                 const errLat = tCoords[1] - drLat;
                 const correctionRate = 0.15; // 15% per frame — subtle but steady correction
                 
                 const nLon = drLon + errLon * correctionRate;
                 const nLat = drLat + errLat * correctionRate;
                 
                 if (Math.abs(nLon - cCoords[0]) > 0.0000001 || Math.abs(nLat - cCoords[1]) > 0.0000001) {
                    f.geometry.coordinates = [nLon, nLat];
                    changed = true;
                 }
             } else {
                 // Fallback: smooth glide for zero-velocity or unknown heading
                 const lerpFactor = Math.min(1.0, dt * 1.5); 
                 const nLon = cCoords[0] + (tCoords[0] - cCoords[0]) * lerpFactor;
                 const nLat = cCoords[1] + (tCoords[1] - cCoords[1]) * lerpFactor;
                 if (Math.abs(nLon - cCoords[0]) > 0.000001 || Math.abs(nLat - cCoords[1]) > 0.000001) {
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
      if (!map || !map.isStyleLoaded() || !map.getSource("live-flights") || !flightDataRef.current) {
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
  // Procedural Flight Tracking Layer
  // ──────────────────────────────────────────────────────────────────────────
  const setupFlights = (map: any, flightsData: any, show: boolean) => {
    if (!map) return;
    if (!map.isStyleLoaded()) {
      map.once("style.load", () => setupFlights(map, flightsData, show));
      return;
    }

    if (flightsData && flightsData.features && flightsData.features.length > 0) {
      if (!map.getSource("live-flights")) {
        map.addSource("live-flights", { type: "geojson", data: flightsData });

        map.addLayer({
          id: "live-flights-layer",
          type: "symbol",
          source: "live-flights",
          layout: {
            "icon-image": "plane-icon",
            "icon-size": 0.8,
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "icon-rotate": ["get", "heading"],
            "icon-rotation-alignment": "map",
            "icon-pitch-alignment": "map",
          }
        });
      } else {
        map.getSource("live-flights").setData(flightsData);
        map.setLayoutProperty("live-flights-layer", "visibility", show ? "visible" : "none");
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
    if (!map) return;

    if (!map.isStyleLoaded()) {
      map.once("style.load", () => setupImpactZones(map, disaster, result));
      return;
    }

    if (!disaster || !result || !result.lat || !result.lon) {
      if (map.getLayer("impact-zones-layer")) map.setLayoutProperty("impact-zones-layer", "visibility", "none");
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


  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;

    import("maplibre-gl").then((maplibregl) => {
      if (mapRef.current) return;

      const styleUrl =
        OPENFREEMAP_STYLE_URLS[mapStyle] || OPENFREEMAP_STYLE_URLS["liberty"];

      const map = new maplibregl.Map({
        container: containerRef.current!,
        style: styleUrl as any,
        center: [72.83, 19.05], // Mumbai
        zoom: 15.0,
        maxZoom: 22,
        pitch: 62, // 3D Camera Tilt
        bearing: -15, // Camera Heading
        antialias: true,
        attributionControl: false
      } as any);

      map.on('error', (e: any) => {
        console.error("MapLibre Error:", e.error || e);
      });

      mapRef.current = map;

      map.addControl(
        new maplibregl.NavigationControl({ visualizePitch: true }),
        "top-right"
      );

      map.on("load", () => {
        // Load custom train SVG
        if (!map.hasImage("train-icon")) {
          const img = new Image(24, 24);
          img.onload = () => map.addImage("train-icon", img);
          img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent('<svg width="24" height="24" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8 2 4 2.5 4 6v9.5a3.5 3.5 0 0 0 3.5 3.5h1l-1.5 1.5v.5h10v-.5L15.5 19h1a3.5 3.5 0 0 0 3.5-3.5V6c0-3.5-4-4-8-4zm0 2c3.5 0 6 .5 6 2v2H6V6c0-1.5 2.5-2 6-2zm-4.5 11a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm9 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>');
        }
        
        // Load custom plane SVG (pointing UP, which corresponds to 0 degrees heading)
        if (!map.hasImage("plane-icon")) {
          const imgPlane = new Image(64, 64);
          imgPlane.onload = () => map.addImage("plane-icon", imgPlane);
          imgPlane.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent('<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><g transform="translate(0, 4)"><path fill="rgba(0,0,0,0.35)" d="M32 4 C35 4, 36 6, 36 10 L36 24 L58 42 L58 46 L36 40 L36 52 L42 58 L42 60 L32 58 L22 60 L22 58 L28 52 L28 40 L6 46 L6 42 L28 24 L28 10 C28 6, 29 4, 32 4 Z"/></g><path fill="#f59e0b" stroke="#ffffff" stroke-width="2" stroke-linejoin="round" d="M32 4 C35 4, 36 6, 36 10 L36 24 L58 42 L58 46 L36 40 L36 52 L42 58 L42 60 L32 58 L22 60 L22 58 L28 52 L28 40 L6 46 L6 42 L28 24 L28 10 C28 6, 29 4, 32 4 Z"/></svg>');
        }

        // Setup 3D Buildings from OpenFreeMap vector tiles
        setup3DBuildings(map, mapStyle, layers.buildings ?? true);
        // Setup Traffic overlay
        setupTraffic(map, traffic, layers.traffic ?? true);
        // Setup AQI overlay
        setupAQI(map, aqi, layers.aqi ?? true);
        // Setup Railways overlay
        setupRailways(map, gisData, trains, layers.railways ?? true);
        // Setup Flights overlay
        setupFlights(map, flights, layers.flights ?? false);
        // Setup Disaster Impact Zones
        setupImpactZones(map, activeDisaster, simulationResult);
        
        if (onMapLoad) {
          onMapLoad(map);
        }
      });

      // ──────────────────────────────────────────────────────────────────────────
      // Train Hover Popup Logic
      // ──────────────────────────────────────────────────────────────────────────
      const trainPopup = new maplibregl.Popup({
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
            ? '<span style="font-size: 9px; padding: 1px 6px; border-radius: 3px; background: #059669; color: #ffffff; font-weight: 700; letter-spacing: 0.5px;">🟢 LIVE GPS</span>'
            : '<span style="font-size: 9px; padding: 1px 6px; border-radius: 3px; background: #64748b; color: #ffffff; font-weight: 700; letter-spacing: 0.5px;">📅 SCHEDULED (GPS OFFLINE)</span>';
          
          // Clearer Status Text derived from the backend (or fallback)
          const primaryStatus = props.status_text || props.status || "Unknown";
          
          // GPS-specific metadata row
          let gpsInfo = '';
          if (isGps) {
            const trainStatus = props.train_status === 1 ? '🔴 At Station' : props.train_status === 0 ? '🟢 Running' : '⚪ Unknown';
            const accuracy = props.train_accuracy === 0 ? 'High' : props.train_accuracy === 1 ? 'Medium' : 'Low';
            
            // Calculate how stale the GPS fix is
            let fixAge = '';
            if (props.live_time) {
              try {
                const fixDate = new Date(props.live_time.replace(' ', 'T') + '+05:30');
                const ageSec = Math.round((Date.now() - fixDate.getTime()) / 1000);
                fixAge = ageSec < 60 ? `${ageSec}s ago` : `${Math.round(ageSec / 60)}m ago`;
              } catch { fixAge = ''; }
            }

            gpsInfo = `
              <div style="margin-top: 8px; padding: 6px 8px; background: #f0fdf4; border-radius: 6px; border: 1px solid #bbf7d0;">
                <div style="font-size: 10px; color: #166534; font-weight: 700; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Telemetry Details</div>
                <div style="display: flex; justify-content: space-between; font-size: 10px; color: #15803d; margin-bottom: 2px;">
                  <span>State:</span><span style="font-weight: 600;">${trainStatus}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 10px; color: #15803d; margin-bottom: 2px;">
                  <span>Accuracy:</span><span style="font-weight: 600;">${accuracy}</span>
                </div>
                ${fixAge ? `<div style="display: flex; justify-content: space-between; font-size: 10px; color: #15803d;">
                  <span>Last Fix:</span><span style="font-weight: 600;">${fixAge}</span>
                </div>` : ''}
              </div>
            `;
          }
          
          const html = `
            <div style="padding: 8px; font-family: 'Inter', sans-serif; min-width: 180px;">
              <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 8px;">
                <span style="font-weight: 700; font-size: 14px; color: #1e293b; line-height: 1.2;">🚆 ${props.id}</span>
              </div>
              
              <div style="margin-bottom: 8px;">
                ${sourceBadge}
              </div>
              
              <div style="background: #f8fafc; padding: 6px 8px; border-radius: 6px; border: 1px solid #e2e8f0;">
                  <div style="font-size: 12px; font-weight: 600; color: #0f172a; margin-bottom: 2px;">${primaryStatus}</div>
                  <div style="font-size: 11px; color: #64748b;">
                      Next Stop: <span style="font-weight: 600; color: #334155;">${props.next_station}</span>
                      <br/>ETA: <span style="font-weight: 600; color: #334155;">${props.next_time}</span>
                  </div>
              </div>
              
              ${gpsInfo}
              
              <div style="font-size: 10px; margin-top: 8px; padding: 3px 6px; border-radius: 4px; display: inline-block; background-color: ${props.color}15; color: ${props.color}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid ${props.color}30;">${props.line}</div>
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
      const flightPopup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: 'flight-popup'
      });

      map.on('mouseenter', 'live-flights-layer', (e: any) => {
        map.getCanvas().style.cursor = 'pointer';
        const coordinates = e.features[0].geometry.coordinates.slice();
        const p = e.features[0].properties;

        const html = `
          <div style="font-family: Inter, sans-serif; padding: 0px; min-width: 180px; overflow: hidden; border-radius: 6px;">
            <div style="width: 100%; height: 100px; background-color: #f1f5f9; background-image: url('http://localhost:8000/api/v1/flights/photo/${p.id}'); background-size: cover; background-position: center; border-bottom: 2px solid #fbbf24;">
            </div>
            <div style="padding: 10px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <span style="font-weight: 800; color: #0f172a; font-size: 15px;">${p.callsign}</span>
                <span style="font-size: 10px; background: #e2e8f0; color: #475569; padding: 2px 6px; border-radius: 4px; font-weight: 600;">${p.country}</span>
              </div>
              <div style="font-size: 12px; color: #475569; display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; justify-content: space-between;">
                  <span>Altitude:</span>
                  <span style="color: #0f172a; font-weight: 600;">${Math.round(p.altitude_m)} m</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span>Speed:</span>
                  <span style="color: #0f172a; font-weight: 600;">${Math.round(p.velocity_ms * 3.6)} km/h</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span>Heading:</span>
                  <span style="color: #0f172a; font-weight: 600;">${Math.round(p.heading)}°</span>
                </div>
              </div>
            </div>
          </div>
        `;

        flightPopup.setLngLat(coordinates).setHTML(html).addTo(map);
      });

      map.on('mouseleave', 'live-flights-layer', () => {
        map.getCanvas().style.cursor = '';
        flightPopup.remove();
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
    const map = mapRef.current;
    if (!map) return;

    const styleUrl =
      OPENFREEMAP_STYLE_URLS[mapStyle] || OPENFREEMAP_STYLE_URLS["liberty"];
    map.setStyle(styleUrl as any);

    map.once("style.load", () => {
      setup3DBuildings(map, mapStyle, layers.buildings ?? true);
      setupTraffic(map, traffic, layers.traffic ?? true);
      setupAQI(map, aqi, layers.aqi ?? true);
      setupRailways(map, gisData, trains, layers.railways ?? true);
      setupFlights(map, flights, layers.flights ?? false);
      setupImpactZones(map, activeDisaster, simulationResult);
    });
  }, [mapStyle]);

  // ──────────────────────────────────────────────────────────────────────────
  // External Telemetry Change Listeners
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded()) return;
    const mapInstance = mapRef.current;
    setupFlights(mapInstance, flights, layers.flights ?? false);
  }, [flights, layers.flights]);

  // Sync 3D Buildings when layer toggle changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.isStyleLoaded()) {
      setup3DBuildings(map, mapStyle, layers.buildings ?? true);
    }
  }, [layers.buildings]);

  // Sync Traffic Data when traffic data updates or layer toggles
  useEffect(() => {
    const mapInstance = mapRef.current;
    if (!mapInstance) return;
    setupTraffic(mapInstance, traffic, layers.traffic ?? true);
  }, [mapRef.current, traffic, layers.traffic]);

  useEffect(() => {
    const mapInstance = mapRef.current;
    if (!mapInstance) return;
    setupRailways(mapInstance, gisData, trains, layers.railways ?? true);
  }, [mapRef.current, gisData, trains, layers.railways]);

  // Sync AQI Data when AQI data updates or layer toggles
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.isStyleLoaded()) {
      setupAQI(map, aqi, layers.aqi ?? true);
    }
  }, [aqi, layers.aqi]);

  // Sync Disaster Impact Zones when simulation results or active disaster changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.isStyleLoaded()) {
      setupImpactZones(map, activeDisaster, simulationResult);
    }
  }, [activeDisaster, simulationResult]);

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
    import("maplibre-gl").then((maplibregl) => {
      if (markerRef.current) markerRef.current.remove();

      const el = document.createElement("div");
      el.className =
        "relative flex items-center justify-center w-9 h-9 cursor-pointer";
      el.innerHTML = `
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
        <span class="relative inline-flex rounded-full h-5 w-5 bg-blue-600 border-2 border-white shadow-lg"></span>
      `;

      const popup = new maplibregl.Popup({ offset: 25 }).setHTML(`
        <div class="p-1.5 font-sans text-slate-900">
          <strong class="text-blue-600 block text-sm font-bold">${selectedLocation.name}</strong>
          <span class="text-xs text-slate-600 font-mono">Lat: ${selectedLocation.lat.toFixed(4)}, Lon: ${selectedLocation.lon.toFixed(4)}</span>
        </div>
      `);

      markerRef.current = new maplibregl.Marker({ element: el })
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
