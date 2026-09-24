import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { signalDatabase } from '@/lib/data/durable';
import { runFeedIntake } from '@/lib/feeds/intake';
import { librarySources } from '@/lib/feeds/library';
import { askJev } from '@/lib/jev/client';
import { feedItemQuestions } from '@/lib/jev/contracts/feedItem';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

const headers = { 'Cache-Control': 'no-store' };
const MAX_FEED_BYTES = 2_000_000;

function authorized(header: string | null, secret: string): boolean {
  const hash = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(header ?? ''), hash(`Bearer ${secret}`));
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; dope.travel feed reader; +https://dope.travel)', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9' },
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const text = await response.text();
    return text.length > MAX_FEED_BYTES ? text.slice(0, MAX_FEED_BYTES) : text;
  } catch {
    return null;
  }
}

/**
 * Daily source-library intake: free feed reads, then one Jev screening per new
 * story under feed-item@1, in shadow mode. Stores stories and decision
 * receipts; nothing is shown on Jev's route until calibration is checked.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'Scheduler is not configured' }, { status: 503, headers });
  if (!authorized(request.headers.get('authorization'), secret)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  const db = signalDatabase();
  if (!db) return NextResponse.json({ error: 'Durable storage is required' }, { status: 503, headers });

  const lease = await db.rpc('claim_meridian_feed_run');
  if (lease.error) return NextResponse.json({ error: 'Apply migration 007 before enabling the feed intake' }, { status: 503, headers });
  if (!lease.data) return NextResponse.json({ ran: false, reason: 'Already ran in the last 20 hours' }, { headers });

  try {
    const result = await runFeedIntake(librarySources(), {
      now: new Date(),
      concurrency: 16,
      fetchText,
      ask: (state) => askJev(state, feedItemQuestions),
      known: async (ids) => {
        if (!ids.length) return new Set();
        const { data } = await db.from('meridian_feed_items').select('id').in('id', ids);
        return new Set((data ?? []).map((row: { id: string }) => row.id));
      },
    });
    if (result.rows.length) {
      const { error } = await db.from('meridian_feed_items').upsert(result.rows, { onConflict: 'id', ignoreDuplicates: true });
      if (error) throw new Error('store items');
    }
    if (result.receipts.length) {
      const { error } = await db.from('jev_decisions').insert(result.receipts.map((receipt) => ({
        contract: receipt.contract,
        subject: receipt.subject,
        state_hash: receipt.stateHash,
        model: receipt.model,
        latency_ms: receipt.latencyMs,
        answers: receipt.answers,
        failure: receipt.failure,
        route: receipt.route,
        action_taken: receipt.actionTaken,
        created_at: receipt.createdAt,
      })));
      if (error) throw new Error('store receipts');
    }
    await db.from('meridian_feed_control').update({ last_status: 'complete', last_counts: result.counts }).eq('name', 'global');
    return NextResponse.json({ ran: true, mode: 'shadow', ...result.counts }, { headers });
  } catch {
    await db.from('meridian_feed_control').update({ last_status: 'error' }).eq('name', 'global');
    return NextResponse.json({ error: 'Feed intake failed; nothing was shown' }, { status: 503, headers });
  }
}
