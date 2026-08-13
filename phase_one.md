````md
# Mumbai Digital Twin (MVP)
## Product Requirements Document (PRD)

---

# 1. Product Vision

Create a real-time interactive 3D digital representation of Mumbai that displays live weather, air quality, marine conditions, traffic, and geographic information.

This MVP is **NOT** intended to perform disaster simulations.

Instead, it creates the entire infrastructure required for future simulations.

Think of it as Google Maps + Live Weather + Live Traffic + Digital Twin.

Future versions will plug simulation engines directly into this platform.

---

# 2. Objectives

The application should:

- Display a realistic 3D Mumbai
- Show live environmental data
- Update automatically
- Be scalable
- Have modular architecture
- Support future disaster simulation modules
- Run smoothly on desktop browsers

---

# 3. Target Users

Primary

- Researchers
- Students
- Urban planners
- Government organizations
- Disaster management teams

Secondary

- Citizens
- Developers
- GIS professionals

---

# 4. MVP Scope

Included

✅ 3D Mumbai Map

✅ Live Weather

✅ Temperature

✅ Humidity

✅ Rainfall

✅ Wind

✅ AQI

✅ Marine Data

✅ Live Traffic

✅ Building Layer

✅ Roads

✅ Railway Network

✅ Water Bodies

✅ Search Locations

✅ Layer Toggle

✅ Time-based Updates

Disaster Simulation

❌ AI Prediction

❌ Flood Engine

❌ Cyclone Engine

❌ Earthquake Engine

❌ Fire Simulation

❌ Economic Damage

❌ Evacuation

---

# 5. Technology Stack

Frontend

- Next.js
- React
- TypeScript
- TailwindCSS

Map Engine

- CesiumJS

3D Rendering

- CesiumJS

Backend

- FastAPI

Language

- Python

Database

- PostgreSQL

Spatial Database

- PostGIS

Cache

- Redis

Realtime Updates

- WebSockets

Deployment

Frontend

- Vercel

Backend

- Modal (Free tier of 30$)

Database

- Supabase PostgreSQL or Neon

Storage

- Cloudflare R2


{Make sure you use only free services making sure all the requirements are fulfilled}
---

# 6. APIs

## Weather

Open-Meteo

Retrieve

- Temperature
- Humidity
- Rainfall
- Wind Speed
- Wind Direction
- Cloud Cover

Refresh

Every 5 minutes

---

## Air Quality

Open-Meteo Air Quality API

Retrieve

- AQI
- PM2.5
- PM10
- CO
- NO₂
- SO₂
- O₃

Refresh

Every 10 minutes

---

## Marine

Open-Meteo Marine API

Retrieve

- Tide
- Wave Height
- Sea Temperature

Refresh

Every 10 minutes

---

## Traffic

TomTom Traffic API

Retrieve

- Congestion
- Road Speed
- Incident Locations

Refresh

Every 2 minutes

---

## Map Data

OpenStreetMap

Retrieve

- Buildings
- Roads
- Railway
- Rivers
- Parks

Static

---

## Elevation

NASA SRTM

Retrieve

- Terrain Height

Static

---

# 7. Architecture

                    User

                      │

              Next.js Frontend

                      │

        ┌─────────────┴─────────────┐

        │                           │

CesiumJS Engine              FastAPI Backend

                                      │

                   ┌──────────────────┼─────────────────┐

                   │                  │                 │

              Weather API       Traffic API      AQI API

                   │

             PostgreSQL + PostGIS

---

# 8. Folder Structure

```
frontend/

    app/

    components/

    hooks/

    services/

    utils/

    types/

backend/

    api/

    services/

    models/

    database/

    websocket/

    scheduler/

shared/

```

---

# 9. UI Layout

```
------------------------------------------------------------

 Search Bar

------------------------------------------------------------

 Layer Panel

 Weather Card

 AQI Card

 Marine Card

 Traffic Card

------------------------------------------------------------

                    3D Mumbai

------------------------------------------------------------

 Bottom Status Bar

```

---

# 10. Main Features

## 10.1 Search

Search

- Area
- Landmark
- Railway Station
- Hospital

Fly camera to location.

---

## 10.2 Live Weather

Display

Temperature

Humidity

Rainfall

Wind

Cloud Cover

Display as floating weather cards.

---

## 10.3 Air Quality

Display

AQI

PM2.5

PM10

Status

Good

Moderate

Poor

Hazardous

---

## 10.4 Marine

Display

Wave Height

Sea Temperature

Tide

---

## 10.5 Traffic

Road colors

Green

Free Flow

Orange

Medium

Red

Heavy

Dark Red

Blocked

---

## 10.6 Layer Toggle

User can enable or disable

Buildings

Roads

Railway

Traffic

AQI

Weather

Terrain

Water

Parks

---

## 10.7 Camera

Support

Pan

Rotate

Tilt

Zoom

Double Click

Fly To

---

# 11. Map Layers

Base Terrain

Buildings

Roads

Railway

Sea

Lakes

Rivers

Vegetation

Traffic

Weather

AQI

Marine

Labels

---

# 12. Weather Overlay

Weather should NOT simply be numbers.

Visualize it.

Examples

Temperature

Blue → Green → Yellow → Red gradient

Rain

Animated rain particles

Wind

Animated arrows

Cloud

Cloud density overlay

---

# 13. AQI Visualization

Colored circles

Green

Yellow

Orange

Red

Purple

Each station displays

AQI

PM2.5

PM10

---

# 14. Marine Visualization

Sea color changes

Wave arrows

Animated movement

---

# 15. Traffic Visualization

Roads colored using congestion.

Moving vehicles are NOT required.

Only road color updates.

---

# 16. Backend Scheduler

Scheduler runs continuously.

Every

2 minutes

Traffic

5 minutes

Weather

10 minutes

AQI

10 minutes

Marine

Store latest values in database.

Frontend reads database.

Never expose third-party APIs directly.

---

# 17. Database Tables

weather

air_quality

marine

traffic

locations

layers

api_logs

system_health

---

# 18. API Wrapper

Every external API should have its own service.

Example

```
services/

    weather_service.py

    traffic_service.py

    air_quality_service.py

    marine_service.py

```

Never call external APIs from controllers.

---

# 19. WebSocket Events

weather_updated

traffic_updated

aqi_updated

marine_updated

system_status

Frontend listens to these events.

---

# 20. Performance Requirements

First Load

< 4 sec

FPS

50+

Map Movement

60 FPS target

Weather Update

< 1 sec

Traffic Update

< 2 sec

Memory

< 600 MB

---

# 21. Error Handling

If an API fails

Keep previous data.

Show

"Last updated 12 mins ago"

Retry automatically.

---

# 22. Logging

Log

API Response Time

API Errors

Database Errors

WebSocket Disconnects

---

# 23. Security

Store API Keys on backend only.

Use environment variables.

Rate-limit API requests.

Validate all client requests.

---

# 24. Scalability

Every module should be independent.

Future modules

Flood Engine

Cyclone Engine

Heatwave Engine

Earthquake Engine

Fire Engine

Population Engine

AI Prediction Engine

No future module should require changes to the existing map engine.

---

# 25. Future Plugin System

Create

/modules

Each future disaster becomes a plugin.

Example

/modules/flood

/modules/cyclone

/modules/fire

/modules/earthquake

Each plugin exposes

initialize()

load()

render()

destroy()

This allows disaster modules to be added without modifying the core project.

---

# 26. UI Theme

Style

Modern

Dark Theme

Glassmorphism

Minimal

Smooth animations

No clutter

Rounded corners

Use blues, cyans, and whites as the primary color palette.

---

# 27. Success Criteria

The MVP is considered complete when:

- Mumbai renders in 3D.
- Buildings, roads, railways, and water bodies are visible.
- Live weather updates automatically.
- AQI updates automatically.
- Marine conditions update automatically.
- Traffic congestion updates automatically.
- Users can search any location in Mumbai.
- Users can toggle map layers.
- The application maintains at least 50 FPS on a typical modern desktop.
- All APIs are abstracted behind backend services.
- The architecture supports adding simulation modules without refactoring the core.

---

# 28. Non-Functional Requirements

- Responsive desktop-first design (mobile support optional for MVP).
- Clean modular codebase.
- Strict TypeScript typing.
- Comprehensive API error handling.
- Configurable refresh intervals.
- Unit tests for backend services.
- Environment-based configuration.
- CI-ready project structure.
- Documentation for setup and deployment.

---

# 29. Deliverables

The AI agent should produce:

1. Complete frontend application.
2. Complete backend API.
3. PostgreSQL/PostGIS schema.
4. API integration services.
5. WebSocket infrastructure.
6. Docker configuration.
7. Environment variable templates.
8. README with installation instructions.
9. Seed scripts for static GIS data.
10. Well-documented, modular code ready for future disaster simulation integration.

```
````
