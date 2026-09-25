import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { EVENTS } from '@/lib/data';
import { anyLiveConfigured, dataMeta, refreshSignals } from '@/lib/data/server';
import { signalDatabase } from '@/lib/data/durable';
import { refreshScenePosts } from '@/lib/data/social-feed';
import { scoreEvents } from '@/lib/buzz/scoring';
import { isHappeningToday } from '@/lib/data/scene-time';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'no-store' };

/** Authorized scheduler only: one globally leased, capped batch; no public vendor proxy. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  // Unconfigured looks the same as a wrong secret from outside; the reason is logged here.
  if (!secret) {
    console.warn('cron: CRON_SECRET is not set');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  }
  const hash = (s: string) => createHash('sha256').update(s).digest();
  if (
    !timingSafeEqual(
      hash(request.headers.get('authorization') ?? ''),
      hash(`Bearer ${secret}`),
    )
  ) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers },
    );
  }
  if (!anyLiveConfigured())
    return NextResponse.json(
      { refreshed: 0, reason: 'No live sources configured' },
      { headers },
    );
  const db = signalDatabase();
  if (!db)
    return NextResponse.json(
      { error: 'Durable signal storage is required for scheduled refresh' },
      { status: 503, headers },
    );
  const lease = await db.rpc('claim_meridian_refresh');
  if (lease.error)
    return NextResponse.json(
      { error: 'Apply the live-signals migration before enabling refresh' },
      { status: 503, headers },
    );
  if (!lease.data)
    return NextResponse.json(
      { refreshed: 0, reason: 'Refresh already claimed' },
      { headers },
    );
  const today = new Date().toISOString().slice(0, 10);
  // Prioritize current and near-future events. A hard batch cap contains upstream fan-out.
  const candidates = EVENTS.filter((e) => e.end >= today)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 60);
  const snapshot = await db
    .from('meridian_signal_snapshots')
    .select('event_id,fetched_at');
  if (snapshot.error)
    return NextResponse.json(
      { error: 'Signal storage unavailable' },
      { status: 503, headers },
    );
  const ages = new Map(
    (snapshot.data ?? []).map((r) => [r.event_id, Date.parse(r.fetched_at)]),
  );
  const ids = candidates
    .sort((a, b) => (ages.get(a.id) ?? 0) - (ages.get(b.id) ?? 0))
    .slice(0, 2)
    .map((e) => e.id);
  const signals = await refreshSignals(ids);
  let social: 'disabled' | 'updated' | 'error' = 'disabled';
  const featuredId = scoreEvents(
    EVENTS.filter((event) => isHappeningToday(event, new Date())),
    { now: today },
  )[0]?.eventId;
  const featured = EVENTS.find((event) => event.id === featuredId);
  if (
    process.env.X_POSTS_ENABLED === '1' &&
    process.env.X_BEARER_TOKEN &&
    featured
  ) {
    // One scene per batch: external content enriches discovery without fan-out per visitor.
    try {
      await refreshScenePosts(featured);
      social = 'updated';
    } catch {
      social = 'error';
    }
  }
  const meta = dataMeta();
  return NextResponse.json(
    { refreshed: Object.keys(signals).length, ids, meta, social },
    { status: meta.storageStatus === 'error' ? 503 : 200, headers },
  );
}
