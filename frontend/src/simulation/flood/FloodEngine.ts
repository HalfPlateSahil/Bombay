import { WaterGrid } from './WaterGrid';

export interface SimulationParams {
  rainfallMmHr: number;
  drainageEfficiencyPct: number; // 0 to 100
  seaLevelM: number;
  timeStepSeconds: number;
}

export class FloodEngine {
  public grid: WaterGrid;
  
  constructor(grid: WaterGrid) {
    this.grid = grid;
  }
  
  /**
   * Advances the simulation by one time step.
   */
  public step(params: SimulationParams): { massError: number } {
    const { width, height } = this.grid;
    const g = this.grid;
    
    // 1. Add Rainfall & Apply Runoff/Drainage
    // Rainfall in meters per timestep
    const rainfallMeters = (params.rainfallMmHr / 1000) * (params.timeStepSeconds / 3600);
    
    let totalWaterBefore = 0;
    for (let i = 0; i < g.waterDepth.length; i++) {
      totalWaterBefore += g.waterDepth[i];
    }
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = g.getIndex(x, y);
        
        // Add effective rainfall (runoff)
        const runoff = rainfallMeters * g.runoffCoefficient[idx];
        let currentWater = g.waterDepth[idx] + runoff;
        
        // Remove drainage
        const effectiveDrainageCap = (g.drainageCapacity[idx] * (params.drainageEfficiencyPct / 100)) / 1000 * (params.timeStepSeconds / 3600);
        currentWater = Math.max(0, currentWater - effectiveDrainageCap);
        
        // Handle Sea Level (Coastal cells) - simplified: edges act as coast
        if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
          if (g.elevation[idx] < params.seaLevelM) {
            currentWater = Math.max(currentWater, params.seaLevelM - g.elevation[idx]);
          }
        }
        
        g.nextWaterDepth[idx] = currentWater;
        totalWaterBefore += runoff; // track mass before flow
      }
    }
    
    // 2. Flow Calculation (Simplified 2D diffusion / gravity flow)
    const newDepth = new Float32Array(g.nextWaterDepth); // Copy current state
    g.velocityX.fill(0);
    g.velocityY.fill(0);
    
    // Helper to get water surface elevation
    const getWSE = (x: number, y: number, depthArray: Float32Array) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return Infinity; // Wall boundary
      const i = y * width + x;
      return g.elevation[i] + depthArray[i];
    };
    
    // Max amount of water that can flow in one step to remain stable
    // Simplified explicit solver
    const dt = params.timeStepSeconds;
    const dx = g.cellSize;
    // Manning's n approximation for urban
    const n = 0.05; 
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = g.getIndex(x, y);
        const currentWSE = getWSE(x, y, g.nextWaterDepth);
        const depth = g.nextWaterDepth[idx];
        
        if (depth <= 0.001) continue; // No water to flow
        
        // Check 4 neighbors
        const neighbors = [
          { nx: x - 1, ny: y, dx: -1, dy: 0, idx: g.getIndex(x - 1, y) },
          { nx: x + 1, ny: y, dx: 1, dy: 0, idx: g.getIndex(x + 1, y) },
          { nx: x, ny: y - 1, dx: 0, dy: -1, idx: g.getIndex(x, y - 1) },
          { nx: x, ny: y + 1, dx: 0, dy: 1, idx: g.getIndex(x, y + 1) }
        ];
        
        let totalOutflow = 0;
        const flows = [0, 0, 0, 0];
        
        for (let i = 0; i < 4; i++) {
          const nb = neighbors[i];
          const nbWSE = getWSE(nb.nx, nb.ny, g.nextWaterDepth);
          
          if (currentWSE > nbWSE) {
            const slope = (currentWSE - nbWSE) / dx;
            // Simplified Manning's equation for velocity: V = (1/n) * R^(2/3) * S^(1/2)
            // Approximate R (hydraulic radius) as depth
            const velocity = (1 / n) * Math.pow(depth, 2/3) * Math.sqrt(slope);
            
            // Flow volume = velocity * Area(dx * depth) * dt
            let flowVol = velocity * depth * dt / dx; // Simplified normalized flow
            
            // Limit flow to available depth / num lower neighbors
            flowVol = Math.min(flowVol, depth * 0.2); 
            
            flows[i] = flowVol;
            totalOutflow += flowVol;
          }
        }
        
        // Apply flows
        if (totalOutflow > 0) {
          const scale = totalOutflow > depth ? depth / totalOutflow : 1;
          for (let i = 0; i < 4; i++) {
            if (flows[i] > 0) {
              const actualFlow = flows[i] * scale;
              const nb = neighbors[i];
              newDepth[idx] -= actualFlow;
              newDepth[nb.idx] += actualFlow;
              
              // Accumulate velocity for visualization
              g.velocityX[idx] += nb.dx * actualFlow;
              g.velocityY[idx] += nb.dy * actualFlow;
            }
          }
        }
      }
    }
    
    // 3. Update arrays and calculate mass error
    let totalWaterAfter = 0;
    for (let i = 0; i < g.waterDepth.length; i++) {
      g.waterDepth[i] = Math.max(0, newDepth[i]); // clamp
      totalWaterAfter += g.waterDepth[i];
      
      // Normalize velocity
      if (g.waterDepth[i] > 0) {
          g.velocityX[i] /= g.waterDepth[i];
          g.velocityY[i] /= g.waterDepth[i];
      }
    }
    
    // Note: Due to boundary conditions (sea level) and drainage, mass is not strictly conserved.
    // This is an approximate check.
    const massError = totalWaterAfter - totalWaterBefore; 
    
    return { massError };
  }
}
