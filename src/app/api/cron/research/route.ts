import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { signalDatabase } from '@/lib/data/durable';
import { runResearchSweep } from '@/lib/research/pipeline';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

const headers = { 'Cache-Control': 'no-store' };

function authorized(header: string | null, secret: string): boolean {
  const hash = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(header ?? ''), hash(`Bearer ${secret}`));
}

/** Fixed, capped daily research batch. No query parameters or user-triggered spend. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'Scheduler is not configured' }, { status: 503, headers });
  if (!authorized(request.headers.get('authorization'), secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  }
  if (!process.env.EXA_API_KEY || !process.env.TREG_TOKEN || !process.env.TYPESAFE_API_KEY) {
    return NextResponse.json({ error: 'Research providers are not configured' }, { status: 503, headers });
  }
  const db = signalDatabase();
  if (!db) return NextResponse.json({ error: 'Durable research storage is required' }, { status: 503, headers });

  const lease = await db.rpc('claim_meridian_research_run');
  if (lease.error) {
    return NextResponse.json({ error: 'Apply the research migration before enabling the scheduler' }, { status: 503, headers });
  }
  if (!lease.data) return NextResponse.json({ ran: false, reason: 'Daily research budget already claimed' }, { headers });

  try {
    const summary = await runResearchSweep();
    return NextResponse.json({ ran: true, ...summary }, { headers });
  } catch {
    await db.from('meridian_research_control')
      .update({ last_status: 'error' })
      .eq('name', 'global');
    return NextResponse.json({ error: 'Research sweep failed; no unreviewed items were published' }, { status: 503, headers });
  }
}
