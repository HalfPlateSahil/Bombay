import { Map } from 'maplibre-gl';

export class RainRenderer {
  private map: Map;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Array<{
    x: number; y: number; length: number; velocity: number; opacity: number; depth: number
  }> = [];
  private splashes: Array<{x: number; y: number; radius: number; maxRadius: number; opacity: number}> = [];
  private intensity: number = 0; // mm/hr
  private animationId: number = 0;
  private isRendering: boolean = false;
  private lastLightningTime: number = 0;
  private lightningActive: boolean = false;
  private lightningOpacity: number = 0;

  constructor(map: Map) {
    this.map = map;
    
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    // Move below some UI but above the map
    this.canvas.style.zIndex = '40'; 
    
    const container = map.getContainer();
    container.appendChild(this.canvas);
    
    this.ctx = this.canvas.getContext('2d', { alpha: true })!;
    
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  private resize() {
    this.canvas.width = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;
    this.initParticles();
  }

  public setIntensity(intensityMmHr: number) {
    this.intensity = intensityMmHr;
    this.initParticles();
    
    if (this.intensity > 0 && !this.isRendering) {
      this.isRendering = true;
      this.render();
    } else if (this.intensity === 0 && this.isRendering) {
      this.isRendering = false;
      cancelAnimationFrame(this.animationId);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  private initParticles() {
    this.particles = [];
    if (this.intensity <= 0) return;
    
    // Non-linear particle count for dramatic effect
    const count = Math.min(3000, Math.floor(Math.pow(this.intensity / 50, 1.2) * 500));
    
    for (let i = 0; i < count; i++) {
      // Depth sorting for parallax (0 near, 1 far)
      const depth = Math.random();
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        length: (15 + Math.random() * 25) * (1.0 - depth * 0.5),
        velocity: (20 + Math.random() * 20) * (1.0 - depth * 0.5),
        opacity: (0.3 + Math.random() * 0.5) * (1.0 - depth * 0.5),
        depth
      });
    }
  }

  private triggerLightning() {
      if (this.intensity > 150 && !this.lightningActive && Date.now() - this.lastLightningTime > 5000) {
          if (Math.random() < 0.01) { // Random chance each frame
              this.lightningActive = true;
              this.lightningOpacity = 0.8 + Math.random() * 0.2;
              this.lastLightningTime = Date.now();
          }
      }
  }

  private render = () => {
    if (!this.isRendering) return;
    
    // Clear with a slight fade for motion blur effect on splashes
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    const bearing = this.map.getBearing();
    // Rain angle based on bearing and intensity (heavier rain = straighter down, wind = angled)
    const windAngle = (bearing * Math.PI) / 180 + (Math.sin(Date.now() / 2000) * 0.1);
    
    this.ctx.lineCap = 'round';
    
    // Render Splashes
    for (let i = this.splashes.length - 1; i >= 0; i--) {
        const s = this.splashes[i];
        this.ctx.beginPath();
        this.ctx.ellipse(s.x, s.y, s.radius * 2, s.radius, 0, 0, Math.PI * 2);
        this.ctx.strokeStyle = `rgba(200, 220, 255, ${s.opacity})`;
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
        
        s.radius += 0.5;
        s.opacity -= 0.05;
        if (s.opacity <= 0) {
            this.splashes.splice(i, 1);
        }
    }

    // Render Particles
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      
      this.ctx.beginPath();
      this.ctx.moveTo(p.x, p.y);
      this.ctx.lineTo(p.x + Math.sin(windAngle) * p.length, p.y + Math.cos(windAngle) * p.length);
      
      // Dynamic color: heavy rain looks whiter, light rain looks more transparent
      this.ctx.strokeStyle = `rgba(220, 230, 255, ${p.opacity})`;
      this.ctx.lineWidth = p.depth < 0.3 ? 1.5 : 0.8;
      this.ctx.stroke();
      
      // Move particle
      p.x += Math.sin(windAngle) * p.velocity;
      p.y += Math.cos(windAngle) * p.velocity;
      
      // Reset and Splash
      if (p.y > this.canvas.height || p.x > this.canvas.width || p.x < 0) {
        // Create splash at bottom occasionally
        if (p.y >= this.canvas.height && Math.random() < 0.1) {
            this.splashes.push({
                x: p.x,
                y: this.canvas.height - Math.random() * 20,
                radius: 1,
                maxRadius: 3 + Math.random() * 4,
                opacity: p.opacity
            });
        }

        p.y = -p.length;
        p.x = Math.random() * this.canvas.width;
      }
    }
    
    // Atmospheric Darkening & Lightning
    if (this.intensity > 20) {
        // Dynamic darkening based on intensity
        const maxDarkness = 0.55;
        const darkness = Math.min(maxDarkness, (this.intensity - 20) / 400);
        
        this.triggerLightning();
        
        if (this.lightningActive) {
            this.ctx.fillStyle = `rgba(255, 255, 255, ${this.lightningOpacity})`;
            this.lightningOpacity -= 0.1;
            if (this.lightningOpacity <= 0) this.lightningActive = false;
        } else {
            this.ctx.fillStyle = `rgba(10, 15, 30, ${darkness})`;
        }
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    this.animationId = requestAnimationFrame(this.render);
  }

  public destroy() {
    this.isRendering = false;
    cancelAnimationFrame(this.animationId);
    window.removeEventListener('resize', this.resize);
    if (this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}
