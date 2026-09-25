import 'server-only';
import { signalDatabase } from '@/lib/data/durable';
import { placeMatcher } from '../extract';
import type { Mention, NewsStatus } from '../match';
import type { Place } from '../places';

const WINDOW_DAYS = 30;
const PAGE = 1000;
const MAX_ROWS = 10_000;
const TTL_MS = 20 * 60 * 1000;

type Row = { title: string | null; excerpt: string | null; url: string; source_name: string; source_tier: string | null; published_at: string | null; fetched_at: string };

export type FeedIndex = { byPlace: Map<string, Mention[]>; status: NewsStatus };

let cached: { index: FeedIndex; at: number } | null = null;
let building: Promise<FeedIndex> | null = null;

const tierOf = (value: string | null): Mention['tier'] => (value === 'A' || value === 'B' ? value : 'C');
const titleKey = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').slice(0, 10).join(' ');

async function build(places: readonly Place[]): Promise<FeedIndex> {
  const db = signalDatabase();
  if (!db) return { byPlace: new Map(), status: { state: 'unavailable', since: null, stories: 0 } };
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  const rows: Row[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
    const { data, error } = await db
      .from('meridian_feed_items')
      .select('title,excerpt,url,source_name,source_tier,published_at,fetched_at')
      .gte('fetched_at', since)
      // Unscreened stories count (Jev screens a few per run); ones it rejected or held don't.
      .not('jev_route', 'in', '(reject,review)')
      .order('fetched_at', { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error('The news library is unavailable');
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < PAGE) break;
  }
  const match = placeMatcher(places);
  const byPlace = new Map<string, Mention[]>();
  const seenTitles = new Map<string, Set<string>>();
  let oldest: string | null = null;
  for (const row of rows) {
    const when = row.published_at ?? row.fetched_at;
    if (!oldest || when < oldest) oldest = when;
    const title = row.title?.trim();
    if (!title) continue;
    for (const key of match(`${title}. ${row.excerpt ?? ''}`)) {
      // A syndicated story counts once per place.
      const titles = seenTitles.get(key) ?? new Set<string>();
      const tk = titleKey(title);
      if (titles.has(tk)) continue;
      titles.add(tk);
      seenTitles.set(key, titles);
      const list = byPlace.get(key) ?? [];
      list.push({ title: title.slice(0, 200), url: row.url, source: row.source_name, tier: tierOf(row.source_tier), publishedAt: when });
      byPlace.set(key, list);
    }
  }
  return { byPlace, status: { state: rows.length ? 'ok' : 'empty', since: oldest, stories: rows.length } };
}

/**
 * Stories from the last 30 days, indexed by the places they name. Rebuilt at
 * most every 20 minutes, one rebuild at a time, serving the previous index
 * meanwhile. When the library can't be read, it says so and the ranking uses
 * the calendar alone.
 */
export async function feedIndex(places: readonly Place[]): Promise<FeedIndex> {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.index;
  building ??= build(places)
    .then((index) => {
      cached = { index, at: Date.now() };
      return index;
    })
    .catch(() => cached?.index ?? { byPlace: new Map(), status: { state: 'unavailable', since: null, stories: 0 } as NewsStatus })
    .finally(() => { building = null; });
  if (cached) return cached.index;
  return building;
}
