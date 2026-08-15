export class WaterGrid {
  public width: number;
  public height: number;
  public cellSize: number; // in meters
  
  public elevation: Float32Array;
  public waterDepth: Float32Array;
  public nextWaterDepth: Float32Array;
  public velocityX: Float32Array;
  public velocityY: Float32Array;
  
  // Surface characteristics
  public runoffCoefficient: Float32Array;
  public drainageCapacity: Float32Array; // mm/hr
  
  constructor(width: number, height: number, cellSize: number = 30) {
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;
    
    const size = width * height;
    this.elevation = new Float32Array(size);
    this.waterDepth = new Float32Array(size);
    this.nextWaterDepth = new Float32Array(size);
    this.velocityX = new Float32Array(size);
    this.velocityY = new Float32Array(size);
    
    this.runoffCoefficient = new Float32Array(size).fill(0.8); // Default urban
    this.drainageCapacity = new Float32Array(size).fill(50); // Default 50mm/hr
  }
  
  public getIndex(x: number, y: number): number {
    return y * this.width + x;
  }
  
  public getWaterSurfaceElevation(x: number, y: number): number {
    const idx = this.getIndex(x, y);
    return this.elevation[idx] + this.waterDepth[idx];
  }
  
  public reset(): void {
    const size = this.width * this.height;
    this.waterDepth.fill(0);
    this.nextWaterDepth.fill(0);
    this.velocityX.fill(0);
    this.velocityY.fill(0);
  }
}
