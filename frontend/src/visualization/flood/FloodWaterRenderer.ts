import { CustomLayerInterface, Map } from 'maplibre-gl';
import maplibregl from 'maplibre-gl';

export class FloodWaterRenderer implements CustomLayerInterface {
  public id = 'flood-water-layer';
  public type: 'custom' = 'custom';
  public renderingMode: '3d' | '2d' = '3d';

  private map: Map | null = null;
  private program: WebGLProgram | null = null;
  private vertexBuffer: WebGLBuffer | null = null;
  
  private aPos: number = -1;
  private uMatrix: WebGLUniformLocation | null = null;
  private uTime: WebGLUniformLocation | null = null;
  private uDepthTexture: WebGLUniformLocation | null = null;

  private depthTexture: WebGLTexture | null = null;

  private gridData: Float32Array | null = null;
  private gridWidth: number = 0;
  private gridHeight: number = 0;
  private cellSize: number = 30; // meters

  private originLon = 72.877;
  private originLat = 19.076;

  private startTime: number = Date.now();

  // Vertex Shader
  private vsSource = `
    uniform mat4 u_matrix;
    attribute vec2 a_pos;
    varying vec2 v_uv;
    void main() {
        // Map Mercator coordinate (0..1) to clip space
        gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
        
        // Pass UV based on bounding box
        // a_pos is Mercator coordinate. We will map this to UV in the fragment shader 
        // by passing raw pos or precomputed UVs. Let's pass local UVs.
        v_uv = a_pos; // We'll handle normalization in frag shader for simplicity
    }
  `;

  // Fragment Shader
  private fsSource = `
    precision highp float;
    
    varying vec2 v_uv;
    uniform float u_time;
    uniform sampler2D u_depth_texture;
    
    // Bounds in Mercator for UV mapping
    uniform vec4 u_bounds; // minX, minY, maxX, maxY
    
    // Simplex 2D noise
    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187, 0.366025403784439,
               -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy) );
      vec2 x0 = v -   i + dot(i, C.xx);
      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
      + i.x + vec3(0.0, i1.x, 1.0 ));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
        dot(x12.zw,x12.zw)), 0.0);
      m = m*m ;
      m = m*m ;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    void main() {
        // Calculate UV relative to the grid bounds
        float u = (v_uv.x - u_bounds.x) / (u_bounds.z - u_bounds.x);
        float v = (v_uv.y - u_bounds.y) / (u_bounds.w - u_bounds.y);
        
        // Sample depth texture (Red channel)
        float depth = texture2D(u_depth_texture, vec2(u, 1.0 - v)).r; // Flip Y for WebGL texture coords
        
        if (depth < 0.05) {
            discard; // Don't render where water is too shallow
        }
        
        // Color mapping based on depth
        vec3 shallowColor = vec3(0.2, 0.7, 0.9);
        vec3 deepColor = vec3(0.05, 0.2, 0.5);
        float depthFactor = clamp(depth / 3.0, 0.0, 1.0);
        vec3 waterColor = mix(shallowColor, deepColor, depthFactor);
        
        // Animated Ripples using noise
        float noiseFreq = 150000.0; // Scale relative to Mercator units
        float noise = snoise(v_uv * noiseFreq + vec2(u_time * 0.5, u_time * 0.2));
        waterColor += noise * 0.05;
        
        // Foam edge at shallow depths
        if (depth < 0.2) {
            float foam = smoothstep(0.2, 0.05, depth) * snoise(v_uv * 200000.0 - u_time);
            waterColor = mix(waterColor, vec3(0.9, 0.95, 1.0), foam * 0.6);
        }
        
        gl_FragColor = vec4(waterColor, 0.7); // 70% opacity fluid
    }
  `;

  public setGridData(gridData: any) {
    if (!gridData || !gridData.waterDepth) return;
    this.gridData = gridData.waterDepth;
    this.gridWidth = gridData.width;
    this.gridHeight = gridData.height;
    this.cellSize = gridData.cellSize;

    if (this.map) {
      this.map.triggerRepaint();
    }
  }

  public onAdd(map: Map, gl: WebGLRenderingContext) {
    this.map = map;

    const createShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = createShader(gl.VERTEX_SHADER, this.vsSource);
    const fs = createShader(gl.FRAGMENT_SHADER, this.fsSource);
    if (!vs || !fs) return;

    this.program = gl.createProgram();
    if (!this.program) return;
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error('Program error:', gl.getProgramInfoLog(this.program));
      return;
    }

    this.aPos = gl.getAttribLocation(this.program, "a_pos");
    this.uMatrix = gl.getUniformLocation(this.program, "u_matrix");
    this.uTime = gl.getUniformLocation(this.program, "u_time");
    this.uDepthTexture = gl.getUniformLocation(this.program, "u_depth_texture");
    const uBounds = gl.getUniformLocation(this.program, "u_bounds");

    // Create Depth Texture
    this.depthTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.depthTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, null);

    // Calculate Bounding Box in Mercator coordinates
    // Approximate lat/lon per meter (Simplified MVP)
    const latPerMeter = 1 / 111320;
    const lonPerMeter = 1 / (111320 * Math.cos(this.originLat * Math.PI / 180));
    
    // Standard mock grid is 100x100 at 30m = 3km x 3km
    const halfWidthLon = (100 * 30 / 2) * lonPerMeter;
    const halfHeightLat = (100 * 30 / 2) * latPerMeter;
    
    const minLngLat = new maplibregl.LngLat(this.originLon - halfWidthLon, this.originLat - halfHeightLat);
    const maxLngLat = new maplibregl.LngLat(this.originLon + halfWidthLon, this.originLat + halfHeightLat);
    
    const minM = maplibregl.MercatorCoordinate.fromLngLat(minLngLat, 0);
    const maxM = maplibregl.MercatorCoordinate.fromLngLat(maxLngLat, 0);

    // Two triangles to form a quad over the grid area
    const vertexArray = new Float32Array([
      minM.x, minM.y,
      maxM.x, minM.y,
      minM.x, maxM.y,
      
      minM.x, maxM.y,
      maxM.x, minM.y,
      maxM.x, maxM.y
    ]);

    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.STATIC_DRAW);
    
    gl.useProgram(this.program);
    gl.uniform4f(uBounds, minM.x, maxM.y, maxM.x, minM.y); // minX, minY, maxX, maxY (Note: Mercator y is inverted)
  }

  public render(gl: WebGLRenderingContext, matrix: number[]) {
    if (!this.program || !this.vertexBuffer || !this.gridData || this.gridWidth === 0) return;

    gl.useProgram(this.program);

    gl.uniformMatrix4fv(this.uMatrix, false, new Float32Array(matrix));
    gl.uniform1f(this.uTime, (Date.now() - this.startTime) / 1000.0);

    // Update Depth Texture
    // WebGL1 requires Uint8Array or Float32Array (if extension enabled). 
    // We will convert Float32 to Uint8 (0-255) for wide compatibility, scaling depth to 0-3m.
    const depthUint8 = new Uint8Array(this.gridWidth * this.gridHeight);
    for (let i = 0; i < this.gridData.length; i++) {
        // Map 0 - 3 meters to 0 - 255
        depthUint8[i] = Math.min(255, Math.max(0, Math.floor((this.gridData[i] / 3.0) * 255)));
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.depthTexture);
    // Upload texture data
    gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.LUMINANCE, 
        this.gridWidth, this.gridHeight, 
        0, gl.LUMINANCE, gl.UNSIGNED_BYTE, depthUint8
    );
    gl.uniform1i(this.uDepthTexture, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 0, 0);
    
    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Request continuous repaint for animation
    if (this.map) {
      this.map.triggerRepaint();
    }
  }

  public onRemove(map: Map, gl: WebGLRenderingContext) {
      if (this.program) gl.deleteProgram(this.program);
      if (this.vertexBuffer) gl.deleteBuffer(this.vertexBuffer);
      if (this.depthTexture) gl.deleteTexture(this.depthTexture);
      this.map = null;
  }
}
