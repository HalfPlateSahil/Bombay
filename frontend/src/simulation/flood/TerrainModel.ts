import { WaterGrid } from './WaterGrid';

export interface TerrainConfig {
  width: number;
  height: number;
  cellSize: number;
  baseElevation: number;
  slopeX: number; // Elevation change per cell in X
  slopeY: number; // Elevation change per cell in Y
}

export class TerrainModel {
  /**
   * Generates a mock DEM (Digital Elevation Model) for the simulation MVP.
   * Creates a terrain that slopes slightly and has some low-lying "bowl" areas
   * to demonstrate water accumulation.
   */
  public static generateMockTerrain(grid: WaterGrid, config: TerrainConfig) {
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const idx = grid.getIndex(x, y);
        
        // Base sloping terrain
        let elev = config.baseElevation + (x * config.slopeX) + (y * config.slopeY);
        
        // Add a "bowl" in the center to demonstrate accumulation
        const cx = grid.width / 2;
        const cy = grid.height / 2;
        const dist = Math.sqrt(Math.pow(x - cx, 2) + Math.pow(y - cy, 2));
        
        if (dist < grid.width / 4) {
           elev -= (grid.width / 4 - dist) * 0.1; // Deepen by up to ~10% of width
        }
        
        grid.elevation[idx] = Math.max(0, elev);
        
        // Randomize runoff slightly to simulate mixed urban/veg
        grid.runoffCoefficient[idx] = 0.5 + Math.random() * 0.4;
        
        // Randomize drainage capacity
        grid.drainageCapacity[idx] = 20 + Math.random() * 60; 
      }
    }
  }
}
