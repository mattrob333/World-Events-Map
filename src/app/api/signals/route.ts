/**
 * GET /api/signals?ids=a,b,c
 *
 * Read-only `Partial<BuzzSignals>` patches from the existing 10-minute TTL
 * cache. Cold or expired entries return no patch, leaving the curated baseline
 * already shipped with the events. Source health reports actual adapter state.
 *
 * This public route never fetches vendors or starts/waits for a refresh.
 * Legacy `force` parameters are ignored so existing deep links keep working.
 * MAX_IDS bounds response size; authorization on POST /api/admin/refresh
 * contains upstream work, and its subset limit also bounds adapter input.
 *
 * Dynamic by necessity (it reads `searchParams`); freshness is owned by the
 * shared TTL cache in `@/lib/data/server`. `Cache-Control: no-store` because the
 * response varies per id list and the useful caching already happened upstream.
 *
 * On a cold cache this returns `{ signals: {} }`: the curated baseline already
 * shipped with the events, even when vendor credentials are configured.
 */

import { NextResponse } from 'next/server';
import { getEventById } from '@/lib/data';
import { getCachedSignalPatches, getSourceHealth, MAX_IDS } from '@/lib/data/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const raw = url.searchParams.get('ids') ?? '';

    const ids = Array.from(
      new Set(
        raw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ).slice(0, MAX_IDS);

    if (!ids.length) {
      return NextResponse.json(
        { signals: {}, unknownIds: [], sources: getSourceHealth() },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const known = ids.filter((id) => getEventById(id) !== undefined);
    const unknownIds = ids.filter((id) => !known.includes(id));

    const signals = Object.fromEntries(getCachedSignalPatches(known));

    return NextResponse.json(
      { signals, unknownIds, sources: getSourceHealth() },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    console.error('signals route failed', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { signals: {}, error: 'Signals are unavailable right now.' },
      { status: 500 },
    );
  }
}
