import { DisasterPlugin } from "../disasterSystem";
import { SimulationResult } from "../../types";

export class ClimateModule implements DisasterPlugin {
  id = "climate";
  name = "Climate Sea Level Rise Projection 2050 / 2100";
  description = "Coastal inundation bathymetry overlay visualizing permanent land submergence for +0.5m to +5.0m rise";

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

    const riseMeters = this.result?.sea_level_rise_m || 2.0;

    // Submergence Mask along Mumbai's coastline (South Mumbai, Marine Drive, Worli, Versova, Mahim Bay)
    const submergenceAlpha = Math.min(0.75, 0.25 + riseMeters * 0.12);

    // Dynamic wave oscillation along coastline
    const waveShift = Math.sin(timeStep * 0.08) * 8.0;

    this.ctx.fillStyle = `rgba(14, 165, 233, ${submergenceAlpha})`;
    
    // Inundation polygon for West coast & East creek
    this.ctx.beginPath();
    this.ctx.moveTo(w * 0.2, 0);
    this.ctx.bezierCurveTo(w * 0.35 + waveShift, h * 0.3, w * 0.32 - waveShift, h * 0.7, w * 0.25, h);
    this.ctx.lineTo(0, h);
    this.ctx.lineTo(0, 0);
    this.ctx.closePath();
    this.ctx.fill();

    // Thane Creek eastern submergence
    this.ctx.fillStyle = `rgba(2, 132, 199, ${submergenceAlpha * 0.9})`;
    this.ctx.beginPath();
    this.ctx.moveTo(w * 0.7, 0);
    this.ctx.bezierCurveTo(w * 0.6 + waveShift, h * 0.4, w * 0.65 - waveShift, h * 0.8, w * 0.75, h);
    this.ctx.lineTo(w, h);
    this.ctx.lineTo(w, 0);
    this.ctx.closePath();
    this.ctx.fill();

    // Floating hazard warning badges for submerged landmarks
    if (this.result?.inundated_landmarks) {
      this.ctx.font = "12px sans-serif";
      this.ctx.fillStyle = "#ef4444";
      let yOffset = h * 0.75;
      for (const lm of this.result.inundated_landmarks) {
        this.ctx.fillRect(w * 0.3, yOffset - 14, 180, 20);
        this.ctx.fillStyle = "#ffffff";
        this.ctx.fillText(`⚠️ ${lm.name} Submerged`, w * 0.305, yOffset);
        yOffset += 26;
      }
    }
  }

  destroy(): void {
    this.ctx = null;
    this.canvas = null;
  }
}
