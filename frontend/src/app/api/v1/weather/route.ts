import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const MUMBAI_LAT = 19.0760;
  const MUMBAI_LON = 72.8777;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${MUMBAI_LAT}&longitude=${MUMBAI_LON}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,cloud_cover`;
  
  const startTime = Date.now();
  try {
    const res = await fetch(url, { next: { revalidate: 30 } });
    if (res.ok) {
      const json = await res.json();
      const cur = json.current || {};
      const temp = cur.temperature_2m ?? 29.0;
      const rain = cur.precipitation ?? 0.0;
      let condition = "Clear Sky";
      if (rain > 50) condition = "Torrential Downpour";
      else if (rain > 10) condition = "Heavy Monsoon Rain";
      else if (rain > 0) condition = "Light Rain";
      else if ((cur.cloud_cover ?? 0) > 70) condition = "Overcast";
      else if ((cur.cloud_cover ?? 0) > 30) condition = "Partly Cloudy";

      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false }) + " IST";

      return NextResponse.json({
        temperature: Math.round(temp * 10) / 10,
        humidity: Math.round((cur.relative_humidity_2m ?? 75) * 10) / 10,
        rainfall: Math.round(rain * 10) / 10,
        wind_speed: Math.round((cur.wind_speed_10m ?? 15.0) * 10) / 10,
        wind_direction: Math.round(cur.wind_direction_10m ?? 230),
        cloud_cover: Math.round(cur.cloud_cover ?? 60),
        condition_text: condition,
        response_ms: Date.now() - startTime,
        updated_at: timeStr,
        status: "live"
      });
    }
  } catch (e) {
    console.warn("Weather API fetch error, returning fallback", e);
  }

  return NextResponse.json({
    temperature: 30.2,
    humidity: 76,
    rainfall: 14.5,
    wind_speed: 19.5,
    wind_direction: 235,
    cloud_cover: 70,
    condition_text: "Monsoon Showers",
    updated_at: "Live Feed",
    status: "cached_fallback"
  });
}

