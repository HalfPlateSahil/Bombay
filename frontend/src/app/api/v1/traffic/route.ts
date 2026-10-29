import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MUMBAI_ROADS = [
  { id: "weh", name: "Western Express Highway (Dahisar to Bandra)", base_speed: 65, coordinates: [[19.25, 72.86], [19.15, 72.85], [19.06, 72.84]] },
  { id: "eeh", name: "Eastern Express Highway (Thane to Sion)", base_speed: 60, coordinates: [[19.21, 72.96], [19.12, 72.92], [19.04, 72.86]] },
  { id: "bwsl", name: "Bandra-Worli Sea Link & Coastal Road", base_speed: 80, coordinates: [[19.04, 72.81], [19.00, 72.81], [18.95, 72.80]] },
  { id: "sv_road", name: "Swami Vivekanand (SV) Road", base_speed: 40, coordinates: [[19.20, 72.84], [19.12, 72.83], [19.05, 72.83]] },
  { id: "lbs_marg", name: "Lal Bahadur Shastri (LBS) Marg", base_speed: 35, coordinates: [[19.19, 72.94], [19.10, 72.90], [19.07, 72.88]] },
  { id: "sclink", name: "Santa Cruz-Chembur Link Road (SCLR)", base_speed: 50, coordinates: [[19.07, 72.86], [19.07, 72.89]] },
  { id: "dharavi_rd", name: "90 Feet Road (Dharavi / Sion)", base_speed: 30, coordinates: [[19.04, 72.85], [19.04, 72.86]] },
  { id: "marine_drive", name: "Marine Drive (Netaji Subhash Chandra Bose Road)", base_speed: 55, coordinates: [[18.95, 72.82], [18.93, 72.82]] }
];

export async function GET() {
  const now = new Date();
  const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60;
  const currentHourIST = (utcHours + 5.5) % 24;

  let rushFactor = 1.0;
  if ((currentHourIST >= 8.5 && currentHourIST <= 11.5) || (currentHourIST >= 17.5 && currentHourIST <= 20.5)) {
    rushFactor = 1.6;
  } else if (currentHourIST >= 1.0 && currentHourIST <= 5.0) {
    rushFactor = 0.4;
  }

  let totalCongestion = 0;
  const roadsStatus = MUMBAI_ROADS.map((r, idx) => {
    // Deterministic pseudo-random variation based on time
    const variance = Math.sin((currentHourIST * 4) + idx) * 8;
    const congestionIndex = Math.min(98.0, Math.max(10.0, 45 * rushFactor + variance));
    const currSpeed = Math.max(8.0, r.base_speed * (1.0 - (congestionIndex / 120.0)));

    let status = "Free Flow";
    if (congestionIndex > 75) status = "Heavy Traffic / Blocked";
    else if (congestionIndex > 50) status = "Moderate Slowdown";

    totalCongestion += congestionIndex;

    return {
      id: r.id,
      name: r.name,
      congestion: Math.round(congestionIndex * 10) / 10,
      current_speed_kmh: Math.round(currSpeed * 10) / 10,
      free_flow_speed_kmh: r.base_speed,
      status,
      coordinates: r.coordinates
    };
  });

  const avgCongestion = Math.round((totalCongestion / MUMBAI_ROADS.length) * 10) / 10;
  const timeStr = now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false }) + " IST";

  return NextResponse.json({
    city_overall_congestion: avgCongestion,
    traffic_index_level: avgCongestion > 70 ? "Severe Rush" : (avgCongestion > 40 ? "Moderate" : "Light"),
    roads: roadsStatus,
    updated_at: timeStr
  });
}

