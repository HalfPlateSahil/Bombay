import { DisasterPlugin } from "../disasterSystem";
import { SimulationResult } from "../../types";

export class FloodModule implements DisasterPlugin {
  id = "flood";
  name = "Urban Flood & Storm Surge Engine";
  description = "Hydrodynamic water accumulation and Mithi river overflow simulation";

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animFrameId: number | null = null;
  private params: any = {};
  private result: SimulationResult | null = null;
  private waterParticles: Array<{ x: number; y: number; r: number; alpha: number; speed: number }> = [];

  initialize(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    
    // Generate water ripple particles
    this.waterParticles = [];
    for (let i = 0; i < 120; i++) {
      this.waterParticles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 25 + 5,
        alpha: Math.random() * 0.4 + 0.1,
        speed: Math.random() * 0.02 + 0.005
      });
    }
  }

  load(params: any, result?: SimulationResult): void {
    this.params = params;
    this.result = result || null;
  }

  render(timeStep: number): void {
    if (!this.ctx || !this.canvas) return;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Center epicenter or default Mumbai Central (Dadar / Hindmata)
    const epicX = w * 0.48;
    const epicY = h * 0.52;

    const depth = this.result?.peak_water_depth_m || 2.5;
    const maxRadius = Math.min(w, h) * 0.4 * (depth / 4.0);

    // Animated water accumulation expansion
    const currentRadius = maxRadius * Math.min(1.0, timeStep / 100);

    // Inundation radial fill with water depth gradient
    const grad = this.ctx.createRadialGradient(epicX, epicY, 0, epicX, epicY, currentRadius);
    grad.addColorStop(0, "rgba(14, 116, 144, 0.75)");    // Deep water cyan-blue
    grad.addColorStop(0.5, "rgba(6, 182, 212, 0.45)");   // Medium inundation
    grad.addColorStop(1, "rgba(56, 189, 248, 0.0)");     // Shallow water fringe

    this.ctx.fillStyle = grad;
    this.ctx.beginPath();
    this.ctx.arc(epicX, epicY, currentRadius, 0, Math.PI * 2);
    this.ctx.fill();

    // Mithi River basin overflow ribbon highlight
    this.ctx.strokeStyle = "rgba(0, 240, 255, 0.8)";
    this.ctx.lineWidth = 6 + Math.sin(timeStep * 0.1) * 2;
    this.ctx.beginPath();
    this.ctx.moveTo(w * 0.55, h * 0.35);
    this.ctx.bezierCurveTo(w * 0.52, h * 0.45, w * 0.48, h * 0.50, w * 0.44, h * 0.60);
    this.ctx.stroke();

    // Water ripple particle animation
    this.ctx.fillStyle = "rgba(186, 230, 253, 0.4)";
    for (const p of this.waterParticles) {
      p.alpha += p.speed;
      if (p.alpha > 0.6 || p.alpha < 0.05) p.speed = -p.speed;
      
      const dx = p.x - epicX;
      const dy = p.y - epicY;
      if (Math.hypot(dx, dy) < currentRadius) {
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(56, 189, 248, ${p.alpha})`;
        this.ctx.fill();
      }
    }
  }

  destroy(): void {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.ctx = null;
    this.canvas = null;
  }
}
