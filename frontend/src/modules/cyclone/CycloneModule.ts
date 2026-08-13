import { DisasterPlugin } from "../disasterSystem";
import { SimulationResult } from "../../types";

export class CycloneModule implements DisasterPlugin {
  id = "cyclone";
  name = "Doppler Radar Volumetric Engine";
  description = "Hyper-realistic fluid particle physics with logarithmic spiral bands and radar color grading";

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private params: any = {};
  private result: SimulationResult | null = null;

  // Particle Engine Data (Float32Arrays for ultra-high performance)
  private readonly NUM_PARTICLES = 8000;
  private pDist: Float32Array = new Float32Array(this.NUM_PARTICLES);
  private pAngle: Float32Array = new Float32Array(this.NUM_PARTICLES);
  private pSize: Float32Array = new Float32Array(this.NUM_PARTICLES);
  private pSpeed: Float32Array = new Float32Array(this.NUM_PARTICLES);
  
  // Animation state
  private globalTime = 0;

  private map: any = null;

  initialize(canvas: HTMLCanvasElement, mapContext?: any): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: true });
    this.map = mapContext;
    
    // Seed 8000 particles across a massive 450px radius disk
    for (let i = 0; i < this.NUM_PARTICLES; i++) {
      this.pDist[i] = Math.random() * 450 + 20; // 20 is the eye boundary
      this.pAngle[i] = Math.random() * Math.PI * 2;
      this.pSize[i] = Math.random() * 3 + 1; // 1px to 4px
      // Base speed variance
      this.pSpeed[i] = Math.random() * 0.02 + 0.01;
    }
  }

  load(params: any, result?: SimulationResult): void {
    this.params = params;
    this.result = result || null;
  }

  private getRadarColor(dist: number, maxDist: number, bandIntensity: number): string {
    const p = Math.min(1.0, Math.max(0, dist / maxDist));
    const alpha = (0.05 + 0.25 * bandIntensity).toFixed(2);
    
    // Doppler Radar Intensity Scale (Red = Intense/Eyewall, Blue = Light/Outer)
    if (p < 0.15) return `rgba(239, 68, 68, ${alpha})`;    // Red
    if (p < 0.35) return `rgba(249, 115, 22, ${alpha})`;   // Orange
    if (p < 0.60) return `rgba(234, 179, 8, ${alpha})`;    // Yellow
    if (p < 0.85) return `rgba(34, 197, 94, ${alpha})`;    // Green
    return `rgba(59, 130, 246, ${alpha})`;                 // Blue
  }

  render(timeStep: number): void {
    if (!this.ctx || !this.canvas) return;
    
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    // Default epicenter if map is not available
    let epicX = w * 0.42;
    let epicY = h * 0.58;
    let scaleY = 1.0;
    let rotation = 0;
    let zoomScale = 1.0;

    // Use the backend result OR the immediate fallback from the clicked location
    const lat = this.result?.lat || this.params?.epicenter?.lat;
    const lon = this.result?.lon || this.params?.epicenter?.lon;

    // 2.5D Matrix Projection Engine
    if (this.map && lat && lon) {
      // 1. Project geographic coordinates to screen pixels
      const proj = this.map.project([lon, lat]);
      epicX = proj.x;
      epicY = proj.y;

      // 2. Extract 3D camera properties
      const pitch = this.map.getPitch(); // Tilt in degrees
      const bearing = this.map.getBearing(); // Rotation in degrees
      const zoom = this.map.getZoom(); // Current zoom level

      // 3. Calculate transformation variables
      scaleY = Math.cos((pitch * Math.PI) / 180.0);
      rotation = (bearing * Math.PI) / 180.0;
      
      // 4. Calculate geographic zoom scale so the cyclone stays a fixed size in the real world
      // Base zoom 12 is arbitrary, we scale relative to that.
      zoomScale = Math.pow(2, zoom - 11.5);
    }

    // Read physics slider from UI
    const windKmh = this.result?.landfall_wind_kmh || this.params?.wind_speed_kmh || 165;
    const forceMultiplier = windKmh / 100.0;
    
    // Scale the physical size of the storm based on wind intensity (base 165 km/h)
    const intensityScale = windKmh / 165.0;

    this.ctx.save();
    
    // Apply geometric matrix transformations so the 2D canvas looks "glued" to the 3D map
    this.ctx.translate(epicX, epicY);
    this.ctx.rotate(-rotation);
    this.ctx.scale(zoomScale * intensityScale, scaleY * zoomScale * intensityScale); // Apply zoom and intensity scale
    this.ctx.translate(-epicX, -epicY);
    
    this.globalTime += 0.016 * forceMultiplier; // Delta time

    // Volumetric glow setup
    this.ctx.globalCompositeOperation = "lighter";

    const maxRadius = 450;
    const eyeRadius = 35;
    const numBands = 5; // Number of distinct spiral arms
    const tightness = 0.035; // How tightly the spiral winds

    for (let i = 0; i < this.NUM_PARTICLES; i++) {
      // 1. Vortex Physics: Angular velocity is faster near the eye (Conservation of Angular Momentum)
      const angularVel = this.pSpeed[i] * forceMultiplier * (200 / (this.pDist[i] + 10));
      this.pAngle[i] += angularVel;
      
      // 2. Inward Draft: Particles get sucked into the eye
      this.pDist[i] -= 0.3 * forceMultiplier;
      
      // 3. Recycle: If sucked into the eye, respawn at outer edge to sustain storm mass
      if (this.pDist[i] < eyeRadius) {
        this.pDist[i] = maxRadius;
        this.pAngle[i] = Math.random() * Math.PI * 2;
      }

      // 4. Logarithmic Spiral Band Math
      // We calculate a phase based on angle and distance to form distinct bands
      const phase = this.pAngle[i] * numBands - this.pDist[i] * tightness - this.globalTime * 3.0;
      // Map sin wave to 0.0 - 1.0
      let bandIntensity = (Math.sin(phase) + 1) / 2;
      
      // Enhance contrast: square the intensity to make bands sharper
      bandIntensity = Math.pow(bandIntensity, 2);

      // Random flicker for atmospheric turbulence
      if (Math.random() > 0.95) bandIntensity *= 1.5;

      const px = epicX + this.pDist[i] * Math.cos(this.pAngle[i]);
      const py = epicY + this.pDist[i] * Math.sin(this.pAngle[i]);

      // Draw particle
      this.ctx.fillStyle = this.getRadarColor(this.pDist[i], maxRadius, bandIntensity);
      this.ctx.beginPath();
      // Particles are slightly stretched along the tangent of their rotation for motion blur
      this.ctx.ellipse(
        px, py, 
        this.pSize[i] * 1.5, // stretched length
        this.pSize[i] * 0.5, // narrow width
        this.pAngle[i] + Math.PI / 2, // tangent angle
        0, Math.PI * 2
      );
      this.ctx.fill();
    }

    // Reset composite for other rendering
    this.ctx.globalCompositeOperation = "source-over";

    // Draw a sharp, dark Eye in the absolute center
    this.ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
    this.ctx.beginPath();
    this.ctx.arc(epicX, epicY, eyeRadius - 5, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Draw outer eyewall ring
    this.ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(epicX, epicY, eyeRadius, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.restore();
  }

  destroy(): void {
    this.ctx = null;
    this.canvas = null;
    // Release memory
    this.pDist = new Float32Array(0);
    this.pAngle = new Float32Array(0);
    this.pSize = new Float32Array(0);
    this.pSpeed = new Float32Array(0);
  }
}
