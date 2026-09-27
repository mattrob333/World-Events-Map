/** Public read-only calendar. Fresh cached demand and approved partner events; no vendor calls. Cached at the edge for a minute (served stale for two more while it refreshes), so moderation changes and expired signals clear within minutes while every visit isn't a fresh build. */
import { NextResponse } from 'next/server';
import { dataMeta, getEnrichedEvents } from '@/lib/data/server';
import { getProviderEvents } from '@/lib/data/provider-events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const events = await getEnrichedEvents();
    let partnerStatus = 'available';
    let partnerEvents: Awaited<ReturnType<typeof getProviderEvents>> = [];
    try { partnerEvents = await getProviderEvents(); } catch { partnerStatus = 'unavailable'; }
    return NextResponse.json(
      { events: [...events, ...partnerEvents], meta: { ...dataMeta(), partnerStatus } },
      {
        headers: {
          'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=120',
        },
      },
    );
  } catch (err) {
    console.error('events route failed', err instanceof Error ? err.message : err);
    // The curated import is static, so reaching here means something
    // pathological. Still: never 500 the globe's only data endpoint.
    return NextResponse.json(
      {
        events: [],
        meta: { eventCount: 0, sources: [] },
        error: 'Events are unavailable right now.',
      },
      { status: 500 },
    );
  }
}
