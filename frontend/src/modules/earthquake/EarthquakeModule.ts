import { DisasterPlugin } from "../disasterSystem";
import { SimulationResult } from "../../types";

export class EarthquakeModule implements DisasterPlugin {
  id = "earthquake";
  name = "Earthquake Shockwave & Structural Damage Engine";
  description = "Seismic pulse wave propagation, Peak Ground Acceleration (PGA) heatmap, and structural shake visualizer";

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private params: any = {};
  private result: SimulationResult | null = null;

  initialize(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
  }

  load(params: any, result?: SimulationResult): void {
    this.params = params;
    this.result = result || null;
  }

  render(timeStep: number): void {
    if (!this.ctx || !this.canvas) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const epicX = w * 0.46;
    const epicY = h * 0.48;

    const mag = this.result?.magnitude_richter || 6.8;
    const maxRadius = Math.min(w, h) * 0.42;

    // Expanding concentric seismic shockwave rings
    const numRings = 5;
    for (let i = 0; i < numRings; i++) {
      const ringPhase = (timeStep * 3.5 + i * 45) % maxRadius;
      const alpha = Math.max(0, 1.0 - (ringPhase / maxRadius));
      
      this.ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
      this.ctx.lineWidth = 4.0 * (mag / 6.0);
      this.ctx.beginPath();
      this.ctx.arc(epicX, epicY, ringPhase, 0, Math.PI * 2);
      this.ctx.stroke();

      // MMI Intensity inner gradient halo
      if (i === 0) {
        const radGrad = this.ctx.createRadialGradient(epicX, epicY, 0, epicX, epicY, ringPhase * 0.5);
        radGrad.addColorStop(0, "rgba(220, 38, 38, 0.6)");
        radGrad.addColorStop(1, "rgba(239, 68, 68, 0.0)");
        this.ctx.fillStyle = radGrad;
        this.ctx.beginPath();
        this.ctx.arc(epicX, epicY, ringPhase * 0.5, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    // Epicenter fault marker crosshair
    this.ctx.strokeStyle = "#ffffff";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(epicX, epicY, 14, 0, Math.PI * 2);
    this.ctx.moveTo(epicX - 22, epicY);
    this.ctx.lineTo(epicX + 22, epicY);
    this.ctx.moveTo(epicX, epicY - 22);
    this.ctx.lineTo(epicX, epicY + 22);
    this.ctx.stroke();
  }

  destroy(): void {
    this.ctx = null;
    this.canvas = null;
  }
}
