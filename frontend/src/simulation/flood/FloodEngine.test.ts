import { WaterGrid } from './WaterGrid';
import { FloodEngine, SimulationParams } from './FloodEngine';
import { TerrainModel } from './TerrainModel';

export function runSyntheticTests() {
  console.log("Running Flood Engine Validation Tests...");
  
  // Test 1: Flat terrain, uniform rainfall -> uniform accumulation
  let grid = new WaterGrid(10, 10, 30);
  TerrainModel.generateMockTerrain(grid, {
      width: 10, height: 10, cellSize: 30, baseElevation: 10, slopeX: 0, slopeY: 0
  });
  
  let engine = new FloodEngine(grid);
  let params: SimulationParams = {
      rainfallMmHr: 100, // 100 mm/hr
      drainageEfficiencyPct: 0, // No drainage
      seaLevelM: 0,
      timeStepSeconds: 3600 // 1 hour
  };
  
  engine.step(params);
  
  // 100mm = 0.1m, but with runoff coefficient of ~0.5 to 0.9, it should be between 0.05 and 0.09
  const midCellIdx = grid.getIndex(5, 5);
  const depth = grid.waterDepth[midCellIdx];
  const expectedDepthMin = 0.1 * 0.5;
  const expectedDepthMax = 0.1 * 0.9;
  
  if (depth >= expectedDepthMin && depth <= expectedDepthMax) {
      console.log("✅ Test 1 Passed: Uniform accumulation on flat terrain.");
  } else {
      console.error(`❌ Test 1 Failed: Expected depth between ${expectedDepthMin} and ${expectedDepthMax}, got ${depth}`);
  }
  
  // Test 2: Bowl accumulation
  grid = new WaterGrid(10, 10, 30);
  // Create a strict bowl: edges high, center low
  for(let y=0; y<10; y++) {
      for(let x=0; x<10; x++) {
          const idx = grid.getIndex(x, y);
          grid.elevation[idx] = (x === 4 || x === 5) && (y === 4 || y === 5) ? 0 : 10;
          grid.runoffCoefficient[idx] = 1.0;
          grid.drainageCapacity[idx] = 0;
      }
  }
  
  engine = new FloodEngine(grid);
  
  // Run for 10 steps with rain
  for (let i = 0; i < 10; i++) {
      engine.step(params);
  }
  
  const centerDepth = grid.waterDepth[grid.getIndex(4, 4)];
  const edgeDepth = grid.waterDepth[grid.getIndex(0, 0)];
  
  if (centerDepth > edgeDepth * 2) {
      console.log("✅ Test 2 Passed: Water accumulated in bowl center.");
  } else {
      console.error(`❌ Test 2 Failed: Bowl accumulation didn't happen as expected. Center: ${centerDepth}, Edge: ${edgeDepth}`);
  }

  // Test 3: Mass conservation check
  const result = engine.step(params);
  if (Math.abs(result.massError) < 0.01) {
      console.log("✅ Test 3 Passed: Mass is conserved within tolerance.");
  } else {
      console.error(`❌ Test 3 Failed: Mass error too high: ${result.massError}`);
  }
}
