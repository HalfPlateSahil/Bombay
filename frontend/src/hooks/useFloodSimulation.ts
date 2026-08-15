import { useState, useEffect, useRef, useCallback } from 'react';
import { SimulationParams } from '../simulation/flood/FloodEngine';

export interface FloodStats {
  inundated_area_sqkm: number;
  total_affected_population: number;
  economic_loss_crores_inr: number;
  peak_water_depth_m: number;
  disaster_type: string;
  impact_score: number;
  severity_level: string;
}

export function useFloodSimulation() {
  const workerRef = useRef<Worker | null>(null);
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  
  const [gridData, setGridData] = useState<{
    width: number;
    height: number;
    cellSize: number;
    waterDepth: Float32Array | null;
    velocityX: Float32Array | null;
    velocityY: Float32Array | null;
  }>({
    width: 0,
    height: 0,
    cellSize: 30,
    waterDepth: null,
    velocityX: null,
    velocityY: null
  });

  const [massError, setMassError] = useState(0);
  const [stats, setStats] = useState<FloodStats | null>(null);

  useEffect(() => {
    // Initialize Web Worker
    workerRef.current = new Worker(new URL('../simulation/flood/FloodSimulationWorker.ts', import.meta.url), { type: 'module' });
    
    workerRef.current.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === 'INITIALIZED') {
        setIsInitialized(true);
        setGridData(prev => ({
          ...prev,
          width: msg.width,
          height: msg.height,
          cellSize: msg.cellSize
        }));
      } else if (msg.type === 'FRAME') {
        setGridData(prev => ({
          ...prev,
          waterDepth: msg.waterDepth,
          velocityX: msg.velocityX,
          velocityY: msg.velocityY
        }));
        setMassError(msg.massError);

        // Compute Impact Statistics dynamically
        if (msg.waterDepth) {
          let maxDepth = 0;
          let floodedCells = 0;
          const wd = msg.waterDepth as Float32Array;
          
          for (let i = 0; i < wd.length; i++) {
             if (wd[i] > maxDepth) maxDepth = wd[i];
             if (wd[i] > 0.15) floodedCells++; // Minor flooding threshold
          }

          const cellAreaSqKm = (30 * 30) / 1000000;
          const floodedAreaSqKm = floodedCells * cellAreaSqKm;
          
          // Heuristic assumptions for MVP (Spec rules 46-53)
          const populationDensityPerSqKm = 32000; // Mumbai approx avg
          const popExposure = Math.floor(floodedAreaSqKm * populationDensityPerSqKm);
          
          // Cost heuristic: Rs 5 Cr per sqkm of >15cm flood
          const economicLossCr = Math.floor(floodedAreaSqKm * 5); 
          
          let severity = "LOW";
          let score = 20;
          if (maxDepth > 2) { severity = "EXTREME"; score = 95; }
          else if (maxDepth > 1) { severity = "VERY SEVERE"; score = 80; }
          else if (maxDepth > 0.6) { severity = "SEVERE"; score = 65; }
          else if (maxDepth > 0.3) { severity = "MODERATE"; score = 45; }

          setStats({
            disaster_type: "flood",
            inundated_area_sqkm: Number(floodedAreaSqKm.toFixed(2)),
            total_affected_population: popExposure,
            economic_loss_crores_inr: economicLossCr,
            peak_water_depth_m: Number(maxDepth.toFixed(2)),
            impact_score: score,
            severity_level: severity
          });
        }
      }
    };
    
    // Auto-init for MVP
    workerRef.current.postMessage({
      type: 'INIT',
      config: {
        width: 100,
        height: 100,
        cellSize: 30,
        baseElevation: 2.0,
        slopeX: 0.01,
        slopeY: -0.01
      }
    });

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const start = useCallback((params: SimulationParams) => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'START', params });
      setIsRunning(true);
    }
  }, []);

  const pause = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'PAUSE' });
      setIsRunning(false);
    }
  }, []);

  const reset = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'RESET' });
      setIsRunning(false);
    }
  }, []);

  return {
    isInitialized,
    isRunning,
    gridData,
    massError,
    stats,
    start,
    pause,
    reset
  };
}
