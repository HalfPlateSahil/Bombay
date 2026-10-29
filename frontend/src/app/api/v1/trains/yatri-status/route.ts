import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    enabled: true,
    status: "active",
    total_trains_with_gps: 42,
    total_trains_queried: 64,
    last_latency_ms: 120,
    last_error_message: null
  });
}

