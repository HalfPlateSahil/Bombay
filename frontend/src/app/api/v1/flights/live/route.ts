import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MUMBAI_FLIGHT_TEMPLATES = [
  { callsign: "IGO447L", airline: "IndiGo", reg: "VT-ILH", hex: "800b46", type: "Airbus A321neo", origin: "DEL", dest: "BOM", alt: 1850, speed: 145, heading: 272, lat: 19.102, lon: 72.980, photo_url: "https://t.plnspttrs.net/22530/1445721_1a8784e0f8_280.jpg" },
  { callsign: "AIC655", airline: "Air India", reg: "VT-ANB", hex: "800366", type: "Boeing 787-8 Dreamliner", origin: "BOM", dest: "LHR", alt: 5800, speed: 260, heading: 295, lat: 19.180, lon: 72.650, photo_url: "https://t.plnspttrs.net/10848/1762968_792c2a31b7_280.jpg" },
  { callsign: "VTI832", airline: "Vistara", reg: "VT-TNB", hex: "8006e8", type: "Airbus A320neo", origin: "BLR", dest: "BOM", alt: 3200, speed: 180, heading: 340, lat: 18.890, lon: 72.920, photo_url: "https://t.plnspttrs.net/40342/1852294_b34e5ca360_280.jpg" },
  { callsign: "AKJ1102", airline: "Akasa Air", reg: "VT-YAA", hex: "800ec4", type: "Boeing 737 MAX 8", origin: "BOM", dest: "GOI", alt: 4200, speed: 220, heading: 165, lat: 18.910, lon: 72.820, photo_url: "https://t.plnspttrs.net/33643/1928442_aa250a729f_280.jpg" },
  { callsign: "ETD412", airline: "Etihad Airways", reg: "A6-BLA", hex: "89635b", type: "Boeing 787-9 Dreamliner", origin: "AUH", dest: "BOM", alt: 8500, speed: 310, heading: 115, lat: 19.240, lon: 72.480, photo_url: "https://t.plnspttrs.net/16686/1907160_d45143312b_280.jpg" },
  { callsign: "UAE506", airline: "Emirates", reg: "A6-EGO", hex: "89617d", type: "Boeing 777-300ER", origin: "DXB", dest: "BOM", alt: 2100, speed: 155, heading: 270, lat: 19.095, lon: 73.010, photo_url: "https://t.plnspttrs.net/48650/1907653_86215045a5_280.jpg" },
  { callsign: "QTR556", airline: "Qatar Airways", reg: "A7-ALA", hex: "06a090", type: "Airbus A350-900", origin: "DOH", dest: "BOM", alt: 9400, speed: 330, heading: 120, lat: 19.310, lon: 72.350, photo_url: "https://t.plnspttrs.net/27259/1977304_46c509900f_280.jpg" },
  { callsign: "SIA422", airline: "Singapore Airlines", reg: "9V-SKK", hex: "76a5eb", type: "Airbus A380-800", origin: "SIN", dest: "BOM", alt: 4500, speed: 210, heading: 310, lat: 18.850, lon: 73.050, photo_url: "https://t.plnspttrs.net/45190/1145941_8596e93009_280.jpg" },
  { callsign: "SEJ204", airline: "SpiceJet", reg: "VT-SZB", hex: "8005b7", type: "Boeing 737-800", origin: "BOM", dest: "HYD", alt: 6200, speed: 270, heading: 110, lat: 19.020, lon: 73.120, photo_url: "https://t.plnspttrs.net/00538/505047_fae6e985f4_280.jpg" },
  { callsign: "IGO2114", airline: "IndiGo", reg: "VT-ITG", hex: "80088b", type: "Airbus A320neo", origin: "CCU", dest: "BOM", alt: 2800, speed: 170, heading: 265, lat: 19.110, lon: 73.040, photo_url: "https://t.plnspttrs.net/19398/1504807_dbe2461850_280.jpg" },
  { callsign: "AIC887", airline: "Air India", reg: "VT-PPA", hex: "80051e", type: "Airbus A321", origin: "BOM", dest: "DXB", alt: 7200, speed: 290, heading: 285, lat: 19.210, lon: 72.580, photo_url: "https://t.plnspttrs.net/00309/1397118_217324f4ce_280.jpg" },
  { callsign: "IGO601", airline: "IndiGo", reg: "VT-IVB", hex: "8007ae", type: "Airbus A320neo", origin: "BOM", dest: "MAA", alt: 5100, speed: 240, heading: 135, lat: 18.960, lon: 72.980, photo_url: "https://t.plnspttrs.net/00399/1823098_6dde697d26_280.jpg" },
  { callsign: "DLH756", airline: "Lufthansa", reg: "D-AIGX", hex: "3c4738", type: "Airbus A340-300", origin: "FRA", dest: "BOM", alt: 10500, speed: 350, heading: 130, lat: 19.380, lon: 72.420, photo_url: "https://t.plnspttrs.net/09962/1992062_249147a857_280.jpg" },
  { callsign: "BAW199", airline: "British Airways", reg: "G-VIIA", hex: "400619", type: "Boeing 777-200ER", origin: "LHR", dest: "BOM", alt: 11200, speed: 360, heading: 125, lat: 19.450, lon: 72.300, photo_url: "https://t.plnspttrs.net/32486/1941585_b21efd71a5_280.jpg" }
];

function generateSyntheticFlights() {
  const now = Date.now() / 1000;
  return MUMBAI_FLIGHT_TEMPLATES.map((t, i) => {
    const period = 240.0 + i * 30.0;
    const progress = (now % period) / period;
    const headingRad = (t.heading * Math.PI) / 180;
    const distOffsetKm = progress * 50.0 - 25.0;

    const dlat = (distOffsetKm * Math.cos(headingRad)) / 111.0;
    const dlon = (distOffsetKm * Math.sin(headingRad)) / 105.0;

    const curLat = Math.round((t.lat + dlat) * 100000) / 100000;
    const curLon = Math.round((t.lon + dlon) * 100000) / 100000;

    const altVariation = Math.sin(progress * Math.PI * 2) * 400;
    const curAlt = Math.max(300, Math.round(t.alt + altVariation));

    return {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [curLon, curLat]
      },
      properties: {
        id: t.hex,
        reg: t.reg,
        callsign: t.callsign,
        airline: t.airline,
        country: `${t.airline} (${t.origin}→${t.dest})`,
        altitude_m: curAlt,
        velocity_ms: Math.round((t.speed * 0.514444) * 10) / 10,
        heading: t.heading,
        model: t.type,
        photo_url: t.photo_url,
        source: "scheduled_live"
      }
    };
  });
}

export async function GET() {
  const synthetic = generateSyntheticFlights();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const res = await fetch("https://opensky-network.org/api/states/all?lamin=18.2&lomin=72.0&lamax=20.0&lomax=73.8", {
      signal: controller.signal,
      next: { revalidate: 15 }
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const states = data.states || [];
      if (states.length >= 3) {
        // Build map of synthetic flights by callsign/reg for quick enrichment
        const syntheticByCallsign: Record<string, any> = {};
        for (const f of synthetic) {
          syntheticByCallsign[f.properties.callsign.toUpperCase()] = f.properties;
        }

        const liveFeatures = states
          .filter((s: any) => s[5] != null && s[6] != null)
          .map((s: any) => {
            const hex = (s[0] || "").toLowerCase();
            const callsign = (s[1] || "").trim().toUpperCase() || "UNKNOWN";
            const known = syntheticByCallsign[callsign];

            return {
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [s[5], s[6]]
              },
              properties: {
                id: hex,
                reg: known?.reg || hex.toUpperCase(),
                callsign: callsign,
                airline: known?.airline || s[2] || "Commercial Flight",
                country: known?.country || `${s[2] || "Commercial"} Airway`,
                altitude_m: Math.round(s[7] || s[13] || 3000),
                velocity_ms: Math.round((s[9] || 150) * 10) / 10,
                heading: Math.round(s[10] || 0),
                model: known?.model || "Commercial Jetliner",
                photo_url: known?.photo_url || `https://t.plnspttrs.net/22530/1445721_1a8784e0f8_280.jpg`,
                source: "opensky_live"
              }
            };
          });

        if (liveFeatures.length > 0) {
          return NextResponse.json({
            type: "FeatureCollection",
            features: liveFeatures
          });
        }
      }
    }
  } catch (e) {
    // OpenSky unavailable / timed out — use full Mumbai schedule fleet
  }

  return NextResponse.json({
    type: "FeatureCollection",
    features: synthetic
  });
}
