import { WaterGrid } from './WaterGrid';
import { FloodEngine, SimulationParams } from './FloodEngine';
import { TerrainModel, TerrainConfig } from './TerrainModel';

// Basic message types for Worker communication
export type WorkerMessage = 
  | { type: 'INIT'; config: TerrainConfig }
  | { type: 'START'; params: SimulationParams }
  | { type: 'PAUSE' }
  | { type: 'RESET' }
  | { type: 'STEP'; params: SimulationParams };

export type WorkerResponse = 
  | { type: 'INITIALIZED'; width: number; height: number; cellSize: number }
  | { type: 'FRAME'; waterDepth: Float32Array; velocityX: Float32Array; velocityY: Float32Array; massError: number };

let grid: WaterGrid | null = null;
let engine: FloodEngine | null = null;
let isRunning = false;
let currentParams: SimulationParams | null = null;
let loopId: any = null;

// The main loop running inside the worker
function loop() {
  if (!isRunning || !engine || !currentParams || !grid) return;
  
  // Advance simulation
  const { massError } = engine.step(currentParams);
  
  // Post state back to main thread (using structured clone / transferable objects if possible)
  // For MVP, we send a copy. In production, use SharedArrayBuffer.
  self.postMessage({
    type: 'FRAME',
    waterDepth: new Float32Array(grid.waterDepth), // clone to avoid detachment issues if transferring
    velocityX: new Float32Array(grid.velocityX),
    velocityY: new Float32Array(grid.velocityY),
    massError
  } as WorkerResponse);
  
  // Run at roughly 30 FPS target
  loopId = setTimeout(loop, 1000 / 30);
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;
  
  switch (msg.type) {
    case 'INIT':
      grid = new WaterGrid(msg.config.width, msg.config.height, msg.config.cellSize);
      TerrainModel.generateMockTerrain(grid, msg.config);
      engine = new FloodEngine(grid);
      
      self.postMessage({
        type: 'INITIALIZED',
        width: grid.width,
        height: grid.height,
        cellSize: grid.cellSize
      } as WorkerResponse);
      break;
      
    case 'START':
      if (!engine) return;
      currentParams = msg.params;
      isRunning = true;
      if (!loopId) loop();
      break;
      
    case 'PAUSE':
      isRunning = false;
      if (loopId) {
        clearTimeout(loopId);
        loopId = null;
      }
      break;
      
    case 'RESET':
      isRunning = false;
      if (loopId) {
        clearTimeout(loopId);
        loopId = null;
      }
      if (grid) {
        grid.reset();
        self.postMessage({
          type: 'FRAME',
          waterDepth: new Float32Array(grid.waterDepth),
          velocityX: new Float32Array(grid.velocityX),
          velocityY: new Float32Array(grid.velocityY),
          massError: 0
        } as WorkerResponse);
      }
      break;
      
    case 'STEP':
      // Manual step for testing or playback
      if (engine) {
        const { massError } = engine.step(msg.params);
        self.postMessage({
          type: 'FRAME',
          waterDepth: new Float32Array(grid!.waterDepth),
          velocityX: new Float32Array(grid!.velocityX),
          velocityY: new Float32Array(grid!.velocityY),
          massError
        } as WorkerResponse);
      }
      break;
  }
};
