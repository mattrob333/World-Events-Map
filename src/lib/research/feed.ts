import 'server-only';

import { signalDatabase } from '@/lib/data/durable';

export interface ResearchFeedItem {
  id: string;
  title: string;
  excerpt: string;
  url: string;
  source: 'exa' | 'treg';
  platform: string;
  category: 'article' | 'social' | 'deal' | 'flight';
  topic: string;
  destinationSlug: string | null;
  publishedAt: string;
  fetchedAt: string;
  author?: string;
}

export interface ResearchFeedResponse {
  status: 'live' | 'unconfigured' | 'error';
  generatedAt: string;
  lastRunStatus: 'complete' | 'partial' | 'error' | 'running' | 'awaiting';
  items: ResearchFeedItem[];
}

type Row = {
  id: string; title: string; excerpt: string; url: string; source: string;
  platform: string; category: string; topic: string; destination_slug: string | null;
  published_at: string | null; fetched_at: string; author: string | null;
};

export function researchItemForPublicFeed(row: Row, now: number): ResearchFeedItem | null {
  if (row.source !== 'exa' && row.source !== 'treg') return null;
  if (row.category !== 'article' && row.category !== 'social' && row.category !== 'deal' && row.category !== 'flight') return null;
  if (!row.published_at) return null;
  const published = Date.parse(row.published_at);
  const maxAge = row.category === 'social' ? 14 : 30;
  if (!Number.isFinite(published) || published > now + 60 * 60_000 || now - published > maxAge * 86_400_000) return null;
  let url: URL;
  try { url = new URL(row.url); } catch { return null; }
  if (url.protocol !== 'https:') return null;
  // Rates or inventory can change minute to minute. A separate verified
  // supplier integration is required before we publish bookable offers.
  if (row.category === 'deal' || row.category === 'flight') return null;
  return {
    id: row.id,
    title: row.title.slice(0, 140),
    excerpt: row.excerpt.slice(0, 260),
    url: url.toString(),
    source: row.source,
    platform: row.platform.slice(0, 50),
    category: row.category,
    topic: row.topic.slice(0, 60),
    destinationSlug: row.destination_slug,
    publishedAt: row.published_at,
    fetchedAt: row.fetched_at,
    ...(row.author ? { author: row.author.slice(0, 70) } : {}),
  };
}

/** A cached editorial snapshot only. Public reads never contact paid providers. */
export async function readResearchFeed(destinationSlug?: string): Promise<ResearchFeedResponse> {
  let generatedAt = '';
  const db = signalDatabase();
  if (!db) return { status: 'unconfigured', generatedAt, lastRunStatus: 'awaiting', items: [] };
  try {
    const { data: run, error: runError } = await db.from('meridian_research_control')
      .select('last_completed_at,last_status')
      .eq('name', 'global')
      .maybeSingle();
    if (runError) throw new Error('research run status unavailable');
    generatedAt = run?.last_completed_at ?? '';
    const lastRunStatus = run?.last_status === 'complete' || run?.last_status === 'partial' ||
      run?.last_status === 'error' || run?.last_status === 'running'
      ? run.last_status : 'awaiting';
    let query = db.from('meridian_research_items')
      .select('id,title,excerpt,url,source,platform,category,topic,destination_slug,published_at,fetched_at,author')
      .eq('decision', 'publish')
      .gte('published_at', new Date(Date.now() - 30 * 86_400_000).toISOString())
      .order('published_at', { ascending: false })
      .limit(60);
    if (destinationSlug) query = query.eq('destination_slug', destinationSlug);
    const { data, error } = await query;
    if (error) throw new Error('research storage unavailable');
    return {
      status: 'live', generatedAt, lastRunStatus,
      items: ((data ?? []) as Row[])
        .map((row) => researchItemForPublicFeed(row, Date.now()))
        .filter((item): item is ResearchFeedItem => Boolean(item))
        .slice(0, 24),
    };
  } catch {
    return { status: 'error', generatedAt, lastRunStatus: 'error', items: [] };
  }
}
