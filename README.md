# Mumbai Atlas: Real-time Digital Twin & Climate / Disaster Simulation Platform

> A real-time 3D interactive clone of Mumbai featuring live weather, air quality, marine conditions, traffic congestion telemetry, and an interactive **Disaster Testing & Climate Simulation Engine**.

---

## 🌟 Key Features

### 1. Real-time Digital Twin Telemetry
- **Live Weather & Monsoon Tracking**: Real-time temperature, humidity, precipitation (mm/hr), wind velocity/direction, cloud cover (powered by Open-Meteo).
- **Air Quality Index (AQI)**: Station-by-station monitoring (Colaba, Worli, BKC, Andheri, Chembur, Thane) with PM2.5, PM10, CO, NO₂, SO₂, O₃ breakdowns.
- **Arabian Sea Marine Telemetry**: Tide levels, astronomical high/low tide predictions, sea surface temperatures, and wave heights.
- **Arterial Highway Traffic Flow**: Real-time traffic congestion scoring across Western Express Highway, Eastern Express Highway, Bandra-Worli Sea Link, Coastal Road, SV Road, and LBS Marg.
- **3D Mumbai Spatial Infrastructure**: Extruded building heights, ward boundaries (A to T), local train railway lines (Western, Central, Harbour), and water bodies (Mithi River, Powai Lake).

### 2. Interactive Disaster Testing & Animated Simulations
- **Pick Epicenter Anywhere on Mumbai Map**: Click anywhere on the map or search landmarks (Dadar, Kurla, BKC, Nariman Point, Dharavi, BOM Airport) to anchor a disaster epicenter.
- **Modular Disaster Engine Plugins** (`/frontend/src/modules/`):
  1. 🌊 **Urban Flood & Coastal Storm Surge (`FloodModule`)**: Hydrodynamic water depth accumulation model considering Mithi River overflow and high tide backwater effect. Animated rising 3D water plane and river ribbon.
  2. 🌀 **Severe Cyclone (`CycloneModule`)**: Rotating Rankine vortex atmospheric spiral, gale-force wind vectors, and coastal seawall surge alerts.
  3. ⚡ **Earthquake Shockwave (`EarthquakeModule`)**: Concentric 3D seismic shock rings, PGA (%g) attenuation, and structural shake visualizer.
  4. 🔥 **Slum / Industrial Wildfire (`FireModule`)**: Dynamic 3D flame particles, Rothermel surface spread, and wind-driven smoke plume cone.
  5. 🌊 **Sea Level Rise 2050 / 2100 (`ClimateModule`)**: Inundation bathymetry layer for +0.5m to +5.0m sea level rise with permanent landmark submergence tags.

### 3. Real-World Impact Analytics Report
- **Impact Severity Rating**: Score from 0 to 100 with hazard alerts.
- **Inundated & Damaged Land Area ($km^2$)**.
- **Affected Population Estimates**.
- **Critical Infrastructure Risk**: Hospital status, fire stations, power grid vulnerability.
- **Transport Paralysis Alerts**: Local train line suspensions (Central, Western, Harbour).
- **Economic Loss Estimation (₹ Crores)**.
- **Report Export**: Download full JSON simulation reports.

---

## 🛠️ Architecture & Tech Stack

```
                          User Desktop Browser
                                   │
                ┌──────────────────┴──────────────────┐
                ▼                                     ▼
      Next.js 14 Frontend                  Canvas & WebGL Engine
  (React 18, TS, TailwindCSS)           (Particle Shaders & 3D Maps)
                │                                     │
                └──────────────────┬──────────────────┘
                                   │ REST / WebSockets
                                   ▼
                         FastAPI Python Backend
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        ▼                          ▼                          ▼
Open-Meteo APIs           TomTom Traffic Service      Disaster Physics Engine
 (Weather, AQI, Marine)  (Highway Congestion Index) (Hydrodynamic, Seismic, Wind)
        │                          │                          │
        └──────────────────────────┼──────────────────────────┘
                                   ▼
                         SQLite / PostGIS DB
```

---

## 🚀 Quick Start Instructions

### Prerequisites
- Node.js v18+ and npm
- Python 3.10+

### Option 1: Start Full Stack Application (Recommended)
Run the root concurrent script which launches both the Python FastAPI backend and Next.js frontend:

```bash
npm run dev
```

- **Frontend Application**: `http://localhost:3000`
- **Backend API & WebSockets**: `http://localhost:8000`
- **Interactive OpenAPI Documentation**: `http://localhost:8000/docs`

### Option 2: Running Backend & Frontend Separately

#### 1. Backend Service
```bash
# Setup virtual environment
python3 -m venv backend/venv
source backend/venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Start FastAPI server
uvicorn backend.main:app --reload --port 8000
```

#### 2. Frontend Application
```bash
cd frontend
npm install
npm run dev
```

---

## 🔌 Modular Plugin System Interface

New disaster simulation plugins can be registered into `frontend/src/modules/` without modifying core map engine code:

```typescript
export interface DisasterPlugin {
  id: string;
  name: string;
  description: string;
  
  initialize(canvas: HTMLCanvasElement): void;
  load(params: any, result?: SimulationResult): void;
  render(timeStep: number): void;
  destroy(): void;
}
```

---

## 📄 License
MIT License. Created for Mumbai Digital Twin & Climate Adaptation Research.
