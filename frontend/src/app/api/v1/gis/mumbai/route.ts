import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

let cachedGisBuffer: Buffer | null = null;

export async function GET() {
  try {
    if (!cachedGisBuffer) {
      const filePath = path.join(process.cwd(), 'src', 'data', 'mumbai_gis.json');
      if (fs.existsSync(filePath)) {
        cachedGisBuffer = fs.readFileSync(filePath);
      } else {
        // Fallback if running in isolated cwd
        const altPath = path.join(process.cwd(), 'frontend', 'src', 'data', 'mumbai_gis.json');
        if (fs.existsSync(altPath)) {
          cachedGisBuffer = fs.readFileSync(altPath);
        }
      }
    }

    if (cachedGisBuffer) {
      return new Response(new Uint8Array(cachedGisBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400'
        }
      });
    }
  } catch (e) {
    console.error("Error reading mumbai_gis.json:", e);
  }

  return NextResponse.json({
    wards: [],
    landmarks: [],
    railways: [],
    metros: [],
    metro_bridges_3d: { type: "FeatureCollection", features: [] },
    buildings_3d: { type: "FeatureCollection", features: [] }
  });
}
