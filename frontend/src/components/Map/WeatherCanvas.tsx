"use client";

import React, { useEffect, useRef } from "react";
import { WeatherData, AQIData, MarineData, WindGridPoint } from "../../types";
import { DisasterEngineManager } from "../../modules/disasterSystem";
import { CycloneModule } from "../../modules/cyclone/CycloneModule";
import { EarthquakeModule } from "../../modules/earthquake/EarthquakeModule";
import { FireModule } from "../../modules/fire/FireModule";
import { ClimateModule } from "../../modules/climate/ClimateModule";

interface WeatherCanvasProps {
  weather: WeatherData | null;
  aqi: AQIData | null;
  marine: MarineData | null;
  layers: Record<string, boolean>;
  activeDisaster: string | null;
  simulationParams: any;
  simulationResult: any;
  mapInstance?: any;
  selectedLocation: { lat: number; lon: number } | null;
  windGrid?: WindGridPoint[];
}

export const WeatherCanvas: React.FC<WeatherCanvasProps> = ({
  weather,
  aqi,
  marine,
  layers,
  activeDisaster,
  simulationParams,
  simulationResult,
  mapInstance,
  selectedLocation,
  windGrid
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const managerRef = useRef<DisasterEngineManager | null>(null);
  const prevCycloneWindRef = useRef<number>(0);

  // Authoritative refs to eliminate particle teardown and frame stutter across layer toggles
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const weatherRef = useRef(weather);
  weatherRef.current = weather;
  const aqiRef = useRef(aqi);
  aqiRef.current = aqi;
  const marineRef = useRef(marine);
  marineRef.current = marine;
  const activeDisasterRef = useRef(activeDisaster);
  activeDisasterRef.current = activeDisaster;
  const simulationParamsRef = useRef(simulationParams);
  simulationParamsRef.current = simulationParams;
  const simulationResultRef = useRef(simulationResult);
  simulationResultRef.current = simulationResult;
  const mapInstanceRef = useRef(mapInstance);
  mapInstanceRef.current = mapInstance;
  const selectedLocationRef = useRef(selectedLocation);
  selectedLocationRef.current = selectedLocation;
  const windGridRef = useRef(windGrid);
  windGridRef.current = windGrid;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateSize = () => {
      canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };
    updateSize();
    window.addEventListener("resize", updateSize);

    if (!managerRef.current) {
      managerRef.current = new DisasterEngineManager(canvas);
    }

    let animId: number;
    let timeStep = 0;

    // Rain particles setup
    const rainParticles: Array<{ x: number; y: number; len: number; speed: number }> = [];
    for (let i = 0; i < 220; i++) {
      rainParticles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        len: Math.random() * 18 + 10,
        speed: Math.random() * 12 + 10
      });
    }

    // Geographic Wind Vector Field Setup
    const NUM_WIND_PARTICLES = 4000;
    // Particles now store longitude, latitude, instead of screen x, y
    const advancedWindParticles: Array<{ lon: number; lat: number; life: number; path: [number, number][] }> = [];
    
    const spawnParticle = () => {
      return {
        lon: 72.7 + Math.random() * 0.45, // Mumbai bounding box lon
        lat: 18.9 + Math.random() * 0.45, // Mumbai bounding box lat
        life: Math.random() * 100,
        path: []
      };
    };

    for (let i = 0; i < NUM_WIND_PARTICLES; i++) {
      advancedWindParticles.push(spawnParticle());
    }

    const renderLoop = () => {
      timeStep++;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const curLayers = layersRef.current;
        const curWeather = weatherRef.current;
        const curMarine = marineRef.current;
        const curDisaster = activeDisasterRef.current;
        const curParams = simulationParamsRef.current;
        const curResult = simulationResultRef.current;
        const curMap = mapInstanceRef.current;
        const curLocation = selectedLocationRef.current;
        const curWindGrid = windGridRef.current;

        // 1. Live Weather Overlay or Flood Disaster Rain Particles
        const isFlood = curDisaster === "flood";
        const floodRain = curParams?.rainfall_mm_hr ?? 120;
        const showRain = Boolean(curLayers.weather || isFlood);

        if (showRain) {
          const currentRain = (curWeather && curWeather.rainfall > 0) ? curWeather.rainfall : (curLayers.weather ? 8 : 0);
          const intensityRatio = isFlood 
            ? Math.min(1.0, Math.max(0.25, floodRain / 180.0))
            : Math.min(1.0, Math.max(0.3, currentRain / 40.0));
          const activeCount = Math.floor(rainParticles.length * intensityRatio);

          ctx.strokeStyle = isFlood ? "rgba(186, 230, 253, 0.85)" : "rgba(186, 230, 253, 0.65)";
          ctx.lineWidth = isFlood ? 1.8 : 1.6;
          ctx.beginPath();
          for (let i = 0; i < activeCount; i++) {
            const p = rainParticles[i];
            const speedMult = isFlood ? Math.max(1.0, floodRain / 100.0) : 1.0;
            p.y += p.speed * speedMult;
            p.x += Math.sin(timeStep * 0.05) * 1.5;
            if (p.y > canvas.height) {
              p.y = -20;
              p.x = Math.random() * canvas.width;
            }
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - 2, p.y + p.len * (isFlood ? 1.3 : 1.0));
          }
          ctx.stroke();
        }

        // 2. Geographic Wind Vector Field with Data-Driven Heatmap
        if (curLayers.wind && curWindGrid && curWindGrid.length > 0 && curMap) {
          
          // 2a. Draw the Color-Coded Heatmap Overlay first
          ctx.globalCompositeOperation = "screen";
          for (const pt of curWindGrid) {
            const px = curMap.project([pt.lon, pt.lat]);
            // Skip if point is too far off-screen to optimize
            if (px.x < -500 || px.x > canvas.width + 500 || px.y < -500 || px.y > canvas.height + 500) continue;
            
            const radius = canvas.width * 0.5; // Massive soft circles to blend into a single heatmap field
            const grad = ctx.createRadialGradient(px.x, px.y, 0, px.x, px.y, radius);
            
            // Map wind speed to colors
            let color = "rgba(100, 150, 255, 0.2)"; // Light Blue (Calm)
            if (pt.wind_speed > 25) color = "rgba(255, 50, 50, 0.25)"; // Red (Storm)
            else if (pt.wind_speed > 15) color = "rgba(180, 50, 255, 0.2)"; // Purple (Strong)
            
            grad.addColorStop(0, color);
            grad.addColorStop(1, "rgba(0,0,0,0)");
            
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(px.x, px.y, radius, 0, Math.PI * 2);
            ctx.fill();
          }

          // 2a.5 Draw the massive Cyclone Heatmap if active
          let cycloneMaxWind = 0;
          if (curDisaster === "cyclone" && curLocation) {
            cycloneMaxWind = curParams?.wind_speed_kmh || curResult?.landfall_wind_kmh || 165;
            
            // Instantly clear particle trails if the cyclone wind speed drastically changes (for fast visual updates)
            if (Math.abs(prevCycloneWindRef.current - cycloneMaxWind) > 5) {
              advancedWindParticles.forEach(p => p.path = []);
              prevCycloneWindRef.current = cycloneMaxWind;
            }

            const px = curMap.project([curLocation.lon, curLocation.lat]);
            
            // Cyclone heatmap size scales massively with intensity
            const cRadius = (cycloneMaxWind / 100.0) * canvas.width * 0.4; 
            const cGrad = ctx.createRadialGradient(px.x, px.y, 0, px.x, px.y, cRadius);
            
            // Zoom Earth style Cyclone Heat signature
            cGrad.addColorStop(0, "rgba(255, 255, 255, 0.3)");  // The Eye (White/Clear)
            cGrad.addColorStop(0.05, "rgba(255, 0, 50, 0.5)");  // Eyewall (Deep Red/Destructive)
            cGrad.addColorStop(0.4, "rgba(200, 50, 255, 0.3)"); // Inner Bands (Purple)
            cGrad.addColorStop(0.8, "rgba(0, 150, 255, 0.15)"); // Outer Bands (Blue)
            cGrad.addColorStop(1, "rgba(0,0,0,0)");
            
            ctx.fillStyle = cGrad;
            ctx.beginPath();
            ctx.arc(px.x, px.y, cRadius, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.globalCompositeOperation = "source-over"; // Reset for particles

          // 2b. Simulate and Draw Geographic Wind Particles
          ctx.lineWidth = 1.2;
          
          for (let i = 0; i < advancedWindParticles.length; i++) {
            const wp = advancedWindParticles[i];

            // Inverse Distance Weighting to interpolate exact wind speed/dir at particle's lat/lon
            let sumSpeed = 0, sumDirX = 0, sumDirY = 0, sumWeight = 0;
            for (const pt of curWindGrid) {
              const d2 = Math.pow(pt.lat - wp.lat, 2) + Math.pow(pt.lon - wp.lon, 2);
              const weight = 1 / (d2 + 0.000001);
              sumSpeed += pt.wind_speed * weight;
              // Convert Meteorological angle to Math angle: (270 - deg)
              const mathRad = ((270 - pt.wind_direction) * Math.PI) / 180.0;
              sumDirX += Math.cos(mathRad) * weight;
              sumDirY += Math.sin(mathRad) * weight;
              sumWeight += weight;
            }
            
            let interpSpeed = sumSpeed / sumWeight;
            let interpRad = Math.atan2(sumDirY / sumWeight, sumDirX / sumWeight);
            
            let finalSpeed = interpSpeed;
            let finalRad = interpRad;
            
            // --- CYCLONE WIND INTERFERENCE PHYSICS (Superposition) ---
            if (curDisaster === "cyclone" && curLocation) {
              const dx = curLocation.lon - wp.lon;
              const dy = curLocation.lat - wp.lat; 
              const dist = Math.sqrt(dx * dx + dy * dy);
              
              // Influence radius scales with storm intensity
              const influenceRadius = (cycloneMaxWind / 100.0) * 0.25; // ~0.4 degrees for a severe cyclone
              const eyeRadius = 0.04;       // ~4.5km calm eye
              
              let cx = 0;
              let cy = 0;

              if (dist < influenceRadius) {
                // Spiral Angle: Tangent + Tiny Inward Draft (counter-clockwise)
                const angleToCenter = Math.atan2(dy, dx);
                const spiralRad = angleToCenter - (Math.PI / 2) + 0.15; 
                
                // Intensity Calculation
                let intensity = 0;
                if (dist > eyeRadius) {
                  const normalizedDist = (dist - eyeRadius) / (influenceRadius - eyeRadius);
                  intensity = Math.pow(1.0 - normalizedDist, 2.0); 
                } else {
                  intensity = (dist / eyeRadius) * 0.5;
                }
                
                cx = Math.cos(spiralRad) * (cycloneMaxWind * intensity);
                cy = Math.sin(spiralRad) * (cycloneMaxWind * intensity);
              }

              const bx = Math.cos(interpRad) * interpSpeed;
              const by = Math.sin(interpRad) * interpSpeed;
              
              const totalX = bx + cx;
              const totalY = by + cy;
              
              finalSpeed = Math.sqrt(totalX*totalX + totalY*totalY);
              finalRad = Math.atan2(totalY, totalX);
            }
            // --- END CYCLONE INTERFERENCE ---

            // Geographic Speed Conversion (Massively slowed down for elegant visual curves)
            const geoSpeed = (finalSpeed / 200000.0);
            
            // Move particle geographically
            wp.lon += Math.cos(finalRad) * geoSpeed;
            wp.lat += Math.sin(finalRad) * geoSpeed;
            wp.life++;

            // Record geographic history
            wp.path.push([wp.lon, wp.lat]);
            if (wp.path.length > 60) {
              wp.path.shift();
            }

            // Respawn if life ends or goes outside bounding box
            if (wp.life > 120 || wp.lon < 72.5 || wp.lon > 73.3 || wp.lat < 18.7 || wp.lat > 19.5) {
              advancedWindParticles[i] = spawnParticle();
              continue;
            }

            // Draw particle by projecting geographic path to screen pixels
            if (wp.path.length > 1) {
              ctx.beginPath();
              const startPx = curMap.project(wp.path[0]);
              
              // Culling: don't draw if entirely off-screen
              if (startPx.x < 0 || startPx.x > canvas.width || startPx.y < 0 || startPx.y > canvas.height) continue;
              
              ctx.moveTo(startPx.x, startPx.y);
              for (let j = 1; j < wp.path.length; j++) {
                const px = curMap.project(wp.path[j]);
                ctx.lineTo(px.x, px.y);
              }
              
              // Fade in and fade out for incredibly smooth lines
              let opacity = 0.8;
              if (wp.life < 30) opacity = (wp.life / 30) * 0.8;
              else if (wp.life > 90) opacity = ((120 - wp.life) / 30) * 0.8;
              
              ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
              ctx.stroke();
            }
          }
        }


        // 3. Marine Waves Overlay (Arabian Sea Coastal Swells & Ripples)
        if (curLayers.marine && curMap) {
          const marineWavePoints = [
            [72.815, 18.915], // Colaba / Prongs Reef
            [72.810, 18.955], // Marine Drive / Chowpatty Bay
            [72.815, 19.015], // Worli Sea Face / Bandra-Worli Sea Link
            [72.820, 19.060], // Bandra Bandstand / Carter Road
            [72.825, 19.105], // Juhu Beach
            [72.805, 19.145], // Versova Beach
            [72.785, 19.195], // Madh Island Coast
            [72.775, 19.245], // Manori / Gorai Beach
            [72.790, 19.000], // Offshore Arabian Sea
            [72.760, 19.080]  // Deep Arabian Sea Swell
          ];

          const waveHeight = curMarine?.wave_height || 0.8;
          const wavePeriod = curMarine?.wave_period || 8.0;
          const cycleSpeed = (Math.PI * 2) / (wavePeriod * 60);

          ctx.save();
          for (let i = 0; i < marineWavePoints.length; i++) {
            const pt = marineWavePoints[i];
            const px = curMap.project(pt);

            if (px.x < -100 || px.x > canvas.width + 100 || px.y < -100 || px.y > canvas.height + 100) continue;

            const phase = (timeStep * cycleSpeed + i * 1.2) % (Math.PI * 2);
            const radius = 25 + Math.sin(phase) * 15 + (waveHeight * 20);
            const opacity = Math.max(0, Math.cos(phase) * 0.45);

            const grad = ctx.createRadialGradient(px.x, px.y, 5, px.x, px.y, radius);
            grad.addColorStop(0, `rgba(56, 189, 248, ${opacity * 0.6})`);
            grad.addColorStop(0.5, `rgba(14, 165, 233, ${opacity * 0.3})`);
            grad.addColorStop(1, "rgba(2, 132, 199, 0)");

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(px.x, px.y, radius, 0, Math.PI * 2);
            ctx.fill();

            // Concentric wave ripple ring
            ctx.strokeStyle = `rgba(186, 230, 253, ${opacity * 0.7})`;
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.arc(px.x, px.y, radius * 0.75, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
        }

        // 4. Disaster Simulation Plugin Rendering
        if (managerRef.current && curDisaster) {
          managerRef.current.renderFrame(timeStep);
        }
      }

      animId = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => {
      window.removeEventListener("resize", updateSize);
      cancelAnimationFrame(animId);
    };
  }, []);

  // Activate disaster module plugin when activeDisaster changes
  useEffect(() => {
    if (!managerRef.current || !canvasRef.current) return;

    if (!activeDisaster) {
      managerRef.current.deactivate();
      return;
    }

    let plugin = null;
    if (activeDisaster === "cyclone") plugin = new CycloneModule();
    else if (activeDisaster === "earthquake") plugin = new EarthquakeModule();
    else if (activeDisaster === "fire") plugin = new FireModule();
    else if (activeDisaster === "climate") plugin = new ClimateModule();

    if (plugin) {
      managerRef.current.registerAndActivate(plugin, { ...simulationParams, epicenter: selectedLocation }, simulationResult, mapInstance);
    }
  }, [activeDisaster, simulationParams, simulationResult, mapInstance]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-10 w-full h-full"
    />
  );
};
