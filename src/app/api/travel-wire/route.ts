/**
 * GET /api/travel-wire
 *
 * Read-only live wire built from per-source patches already collected by an
 * authorized refresh. This route never calls vendors and ignores any query
 * string, including a legacy `force` flag.
 */

import { NextResponse } from 'next/server';
import { getEventById } from '@/lib/data';
import { readSourceObservations } from '@/lib/data/server';
import { buildLiveTravelWire, type WireEventRef } from '@/lib/signals/wire';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const observations = readSourceObservations();
    const events: WireEventRef[] = [];
    const seen = new Set<string>();
    for (const observation of observations) {
      if (seen.has(observation.eventId)) continue;
      seen.add(observation.eventId);
      const event = getEventById(observation.eventId);
      if (!event) continue;
      events.push({
        id: event.id,
        name: event.name,
        city: event.city,
        countryCode: event.countryCode,
      });
    }

    return NextResponse.json(
      buildLiveTravelWire({
        now: new Date().toISOString(),
        observations,
        events,
      }),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    console.error('travel-wire route failed', err instanceof Error ? err.message : err);
    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        status: 'empty',
        note: 'Travel wire unavailable',
        cards: [],
        omitted: 0,
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
