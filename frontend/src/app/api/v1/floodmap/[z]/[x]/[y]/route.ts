import { NextResponse } from 'next/server';
import { PNG } from 'pngjs';

export const dynamic = 'force-dynamic';

const MAPBOX_TOKEN = "pk.eyJ1IjoiaGFsZnBsYXRlc2FoaWwiLCJhIjoiY21zdGY5ZXI5MGlmcDJ5cnlvM20zNnlxaCJ9.hIFOeLt9Vg_YerMUf68QZA";

// Standard 256x256 blank transparent PNG buffer
let blankTileBuffer: Buffer | null = null;
function getBlankTile(): Buffer {
  if (!blankTileBuffer) {
    const png = new PNG({ width: 256, height: 256 });
    blankTileBuffer = PNG.sync.write(png);
  }
  return blankTileBuffer;
}

// In-memory cache for terrain elevation arrays: key -> { width, height, heights }
interface CachedDEM {
  width: number;
  height: number;
  heights: Float32Array;
}
const demCache = new Map<string, CachedDEM>();

export async function GET(
  request: Request,
  { params }: { params: { z: string; x: string; y: string } }
) {
  const z = parseInt(params.z, 10);
  const x = parseInt(params.x, 10);
  const y = parseInt(params.y, 10);

  const { searchParams } = new URL(request.url);
  const elev = parseFloat(searchParams.get('elev') || '0.0');

  if (isNaN(z) || isNaN(x) || isNaN(y) || z > 14) {
    return new Response(new Uint8Array(getBlankTile()), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' }
    });
  }

  const cacheKey = `${z}/${x}/${y}`;
  let demData = demCache.get(cacheKey);

  if (!demData) {
    const terrainUrl = `https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1/${z}/${x}/${y}.pngraw?access_token=${MAPBOX_TOKEN}`;
    try {
      const res = await fetch(terrainUrl, { next: { revalidate: 86400 } });
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const inputPng = PNG.sync.read(Buffer.from(arrayBuf));
        const { width, height } = inputPng;
        const totalPixels = width * height;
        const heights = new Float32Array(totalPixels);

        for (let i = 0; i < totalPixels; i++) {
          const idx = i * 4;
          const r = inputPng.data[idx];
          const g = inputPng.data[idx + 1];
          const b = inputPng.data[idx + 2];
          // Mapbox Terrain-RGB formula: height = -10000 + ((R * 65536 + G * 256 + B) * 0.1)
          heights[i] = -10000.0 + ((r * 65536.0 + g * 256.0 + b) * 0.1);
        }

        demData = { width, height, heights };

        // Cache size bounded to prevent memory growth
        if (demCache.size > 250) {
          const firstKey = demCache.keys().next().value;
          if (firstKey) demCache.delete(firstKey);
        }
        demCache.set(cacheKey, demData);
      }
    } catch (e) {
      console.warn(`Error fetching terrain DEM for ${cacheKey}:`, e);
    }
  }

  if (!demData) {
    return new Response(new Uint8Array(getBlankTile()), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=60' }
    });
  }

  const { width, height, heights } = demData;
  const totalPixels = width * height;
  const outPng = new PNG({ width, height });
  let hasFloodedPixels = false;

  for (let i = 0; i < totalPixels; i++) {
    const h = heights[i];
    const outIdx = i * 4;

    // Inundation: Land elevation is strictly above mean sea level (> 0.05m)
    // and below or equal to the modeled flood water level (<= elev).
    // The open ocean (h <= 0.05m) is left transparent so it renders naturally as sea.
    if (h > 0.05 && h <= elev) {
      hasFloodedPixels = true;
      const depth = Math.min(10.0, elev - h);

      if (depth <= 0.8) {
        // Shallow inundation / street waterlogging (< 0.8m): Cyan
        outPng.data[outIdx] = 34;      // R
        outPng.data[outIdx + 1] = 211; // G
        outPng.data[outIdx + 2] = 238; // B (#22d3ee)
        outPng.data[outIdx + 3] = 160; // Alpha
      } else if (depth <= 2.2) {
        // Moderate flood / transit disruption (0.8m - 2.2m): Azure
        outPng.data[outIdx] = 14;      // R
        outPng.data[outIdx + 1] = 165; // G
        outPng.data[outIdx + 2] = 233; // B (#0ea5e9)
        outPng.data[outIdx + 3] = 195; // Alpha
      } else {
        // Critical deep water / building ground floor submerged (> 2.2m): Deep blue
        outPng.data[outIdx] = 2;       // R
        outPng.data[outIdx + 1] = 132; // G
        outPng.data[outIdx + 2] = 199; // B (#0284c7)
        outPng.data[outIdx + 3] = 225; // Alpha
      }
    }
  }

  if (!hasFloodedPixels) {
    return new Response(new Uint8Array(getBlankTile()), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=300' }
    });
  }

  const outBuf = PNG.sync.write(outPng);
  return new Response(new Uint8Array(outBuf), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=300'
    }
  });
}
