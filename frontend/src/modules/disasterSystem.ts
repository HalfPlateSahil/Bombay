import { SimulationResult } from "../types";

export interface DisasterPlugin {
  id: string;
  name: string;
  description: string;
  
  initialize(canvas: HTMLCanvasElement, mapContext?: any): void;
  load(params: any, result?: SimulationResult): void;
  render(timeStep: number): void;
  destroy(): void;
}

export class DisasterEngineManager {
  private activePlugin: DisasterPlugin | null = null;
  private canvas: HTMLCanvasElement | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  public registerAndActivate(plugin: DisasterPlugin, params: any, result?: SimulationResult, mapContext?: any) {
    if (this.activePlugin) {
      this.activePlugin.destroy();
    }
    this.activePlugin = plugin;
    if (this.canvas) {
      this.activePlugin.initialize(this.canvas, mapContext);
      this.activePlugin.load(params, result);
    }
  }

  public renderFrame(timeStep: number) {
    if (this.activePlugin) {
      this.activePlugin.render(timeStep);
    }
  }

  public deactivate() {
    if (this.activePlugin) {
      this.activePlugin.destroy();
      this.activePlugin = null;
    }
  }
}
