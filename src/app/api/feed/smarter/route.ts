/**
 * GET /api/feed/smarter
 *
 * The home page's "Travel smarter" section: this week's points plays, lounge
 * news, fare deals, gear and new stays from the points blogs, deal sites and
 * travel magazines in the news intake. Read-only, takes no input, calls no
 * paid service, and is cached at the edge for ten minutes.
 */

import { NextResponse } from 'next/server';
import { signalDatabase } from '@/lib/data/durable';
import { pickSmarter, SMARTER_SOURCES, type SmarterRow, type SmarterStory } from '@/lib/smarter/lanes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TTL_MS = 20 * 60 * 1000;
let cached: { stories: SmarterStory[]; at: number } | null = null;

type Row = { title: string | null; excerpt: string | null; url: string; source_name: string; source_tier: string | null; published_at: string | null; fetched_at: string };

async function load(): Promise<SmarterStory[] | null> {
  const db = signalDatabase();
  if (!db) return null;
  const since = new Date(Date.now() - 8 * 86_400_000).toISOString();
  const { data, error } = await db
    .from('meridian_feed_items')
    .select('title,excerpt,url,source_name,source_tier,published_at,fetched_at')
    .in('source_name', Object.keys(SMARTER_SOURCES))
    .gte('fetched_at', since)
    .not('jev_route', 'in', '(reject,review)')
    .order('fetched_at', { ascending: false })
    .limit(1000);
  if (error) return null;
  const rows: SmarterRow[] = ((data ?? []) as Row[])
    .filter((row) => row.title?.trim() && /^https:\/\//.test(row.url))
    .map((row) => ({
      title: row.title!.trim().slice(0, 200),
      excerpt: (row.excerpt ?? '').slice(0, 260),
      url: row.url,
      source: row.source_name,
      tier: row.source_tier === 'A' || row.source_tier === 'B' ? row.source_tier : 'C',
      publishedAt: row.published_at ?? row.fetched_at,
    }));
  return pickSmarter(rows, new Date());
}

export async function GET() {
  if (!cached || Date.now() - cached.at > TTL_MS) {
    const stories = await load().catch(() => null);
    if (stories) cached = { stories, at: Date.now() };
    else if (!cached) {
      return NextResponse.json({ state: 'unavailable', stories: [] }, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60' } });
    }
  }
  return NextResponse.json(
    { state: cached!.stories.length ? 'ok' : 'empty', stories: cached!.stories },
    { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=1800' } },
  );
}
