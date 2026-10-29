import { NextResponse } from 'next/server';
import { PNG } from 'pngjs';

export const dynamic = 'force-dynamic';

const MAPBOX_TOKEN = "pk.eyJ1IjoiaGFsZnBsYXRlc2FoaWwiLCJhIjoiY21zdGY5ZXI5MGlmcDJ5cnlvM20zNnlxaCJ9.hIFOeLt9Vg_YerMUf68QZA";

// Blank 512x512 transparent PNG
let blankTileBuffer: Buffer | null = null;
function getBlankTile(): Buffer {
  if (!blankTileBuffer) {
    const png = new PNG({ width: 512, height: 512 });
    blankTileBuffer = PNG.sync.write(png);
  }
  return blankTileBuffer;
}

// In-memory cache for terrain elevation arrays
const demCache = new Map<string, Float32Array>();

export async function GET(
  request: Request,
  { params }: { params: { z: string; x: string; y: string } }
) {
  const z = parseInt(params.z, 10);
  const x = parseInt(params.x, 10);
  const y = parseInt(params.y, 10);

  const { searchParams } = new URL(request.url);
  const elev = parseFloat(searchParams.get('elev') || '0.0');

  if (isNaN(z) || isNaN(x) || isNaN(y)) {
    return new Response(new Uint8Array(getBlankTile()), { headers: { 'Content-Type': 'image/png' } });
  }

  const cacheKey = `${z}/${x}/${y}`;
  let heightArr = demCache.get(cacheKey);

  if (!heightArr) {
    const terrainUrl = `https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1/${z}/${x}/${y}.pngraw?access_token=${MAPBOX_TOKEN}`;
    try {
      const res = await fetch(terrainUrl, { next: { revalidate: 86400 } });
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const inputPng = PNG.sync.read(Buffer.from(arrayBuf));
        const totalPixels = inputPng.width * inputPng.height;
        heightArr = new Float32Array(totalPixels);

        for (let i = 0; i < totalPixels; i++) {
          const idx = i * 4;
          const r = inputPng.data[idx];
          const g = inputPng.data[idx + 1];
          const b = inputPng.data[idx + 2];
          // Mapbox Terrain-RGB: height = -10000 + ((R * 256 * 256 + G * 256 + B) * 0.1)
          heightArr[i] = -10000.0 + ((r * 65536.0 + g * 256.0 + b) * 0.1);
        }

        if (demCache.size > 200) {
          const firstKey = demCache.keys().next().value;
          if (firstKey) demCache.delete(firstKey);
        }
        demCache.set(cacheKey, heightArr);
      }
    } catch (e) {
      console.warn(`Error fetching terrain DEM for ${cacheKey}:`, e);
    }
  }

  if (!heightArr) {
    return new Response(new Uint8Array(getBlankTile()), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=60' }
    });
  }

  const outPng = new PNG({ width: 512, height: 512 });
  let hasFloodedPixels = false;

  for (let i = 0; i < 512 * 512; i++) {
    const h = heightArr[i];
    const outIdx = i * 4;

    // Land submerged when 0.05 < h <= elev
    if (h > 0.05 && h <= elev) {
      hasFloodedPixels = true;
      const depth = Math.min(15.0, elev - h);
      if (depth <= 1.0) {
        // Shallow water: #22d3ee (34, 211, 238, 190)
        outPng.data[outIdx] = 34;
        outPng.data[outIdx + 1] = 211;
        outPng.data[outIdx + 2] = 238;
        outPng.data[outIdx + 3] = 190;
      } else if (depth <= 3.0) {
        // Moderate water: #0ea5e9 (14, 165, 233, 225)
        outPng.data[outIdx] = 14;
        outPng.data[outIdx + 1] = 165;
        outPng.data[outIdx + 2] = 233;
        outPng.data[outIdx + 3] = 225;
      } else {
        // Critical deep water: #0284c7 (2, 132, 199, 245)
        outPng.data[outIdx] = 2;
        outPng.data[outIdx + 1] = 132;
        outPng.data[outIdx + 2] = 199;
        outPng.data[outIdx + 3] = 245;
      }
    } else if (h > -0.5 && h <= 0.05 && elev > 1.5) {
      // Coastal surge: #38bdf8 (56, 189, 248, 140)
      hasFloodedPixels = true;
      outPng.data[outIdx] = 56;
      outPng.data[outIdx + 1] = 189;
      outPng.data[outIdx + 2] = 248;
      outPng.data[outIdx + 3] = 140;
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
