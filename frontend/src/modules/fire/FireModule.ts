import { DisasterPlugin } from "../disasterSystem";
import { SimulationResult } from "../../types";

export class FireModule implements DisasterPlugin {
  id = "fire";
  name = "Slum & Industrial Wildfire Dispersion Engine";
  description = "Dynamic 3D flame particles, smoke plume propagation vector, and evacuation radius visualizer";

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private params: any = {};
  private result: SimulationResult | null = null;
  private flameParticles: Array<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number }> = [];

  initialize(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.flameParticles = [];
  }

  load(params: any, result?: SimulationResult): void {
    this.params = params;
    this.result = result || null;
  }

  render(timeStep: number): void {
    if (!this.ctx || !this.canvas) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const epicX = w * 0.50;  // Dharavi / Chembur default
    const epicY = h * 0.50;

    const fireRad = Math.min(120, (this.result?.fire_radius_m || 400) / 4.0);

    // Spawn flame particles
    if (this.flameParticles.length < 180) {
      this.flameParticles.push({
        x: epicX + (Math.random() - 0.5) * fireRad * 1.2,
        y: epicY + (Math.random() - 0.5) * fireRad * 1.2,
        vx: (Math.random() - 0.2) * 1.5,
        vy: -Math.random() * 3.0 - 1.0,
        life: 0,
        maxLife: Math.random() * 40 + 20,
        size: Math.random() * 12 + 6
      });
    }

    // Render Evacuation Zone Outer Circle
    const evacRad = fireRad * 2.5;
    this.ctx.strokeStyle = "rgba(234, 179, 8, 0.8)";
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([8, 6]);
    this.ctx.beginPath();
    this.ctx.arc(epicX, epicY, evacRad, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // Wind-driven toxic smoke plume cone
    const windAngle = ((this.params?.wind_direction_deg || 240) * Math.PI) / 180.0;
    const plumeLength = 220.0;
    const plumeX = epicX + Math.cos(windAngle) * plumeLength;
    const plumeY = epicY + Math.sin(windAngle) * plumeLength;

    const smokeGrad = this.ctx.createLinearGradient(epicX, epicY, plumeX, plumeY);
    smokeGrad.addColorStop(0, "rgba(220, 38, 38, 0.7)");
    smokeGrad.addColorStop(0.3, "rgba(120, 113, 108, 0.5)");
    smokeGrad.addColorStop(1, "rgba(68, 64, 60, 0.0)");

    this.ctx.fillStyle = smokeGrad;
    this.ctx.beginPath();
    this.ctx.moveTo(epicX, epicY);
    this.ctx.lineTo(plumeX + Math.sin(windAngle) * 70, plumeY - Math.cos(windAngle) * 70);
    this.ctx.lineTo(plumeX - Math.sin(windAngle) * 70, plumeY + Math.cos(windAngle) * 70);
    this.ctx.closePath();
    this.ctx.fill();

    // Render Flame Particles
    for (let i = this.flameParticles.length - 1; i >= 0; i--) {
      const p = this.flameParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life++;

      if (p.life > p.maxLife) {
        this.flameParticles.splice(i, 1);
        continue;
      }

      const lifeRatio = p.life / p.maxLife;
      const curSize = p.size * (1 - lifeRatio * 0.5);

      let color = "rgba(239, 68, 68, 0.9)";     // Red core
      if (lifeRatio > 0.4) color = "rgba(249, 115, 22, 0.8)"; // Orange
      if (lifeRatio > 0.7) color = "rgba(250, 204, 21, 0.6)"; // Yellow tip

      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, curSize, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  destroy(): void {
    this.ctx = null;
    this.canvas = null;
  }
}
