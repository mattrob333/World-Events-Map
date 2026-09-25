/**
 * GET /api/heat?country=JP&limit=12
 *
 * What's hot right now: calendar events that are on or coming up, scored by
 * measured movement (Wikipedia views of their article, mentions in our news
 * intake). Only what made the cut is returned, hottest first. Read-only, no
 * paid calls, cached at the edge for an hour.
 */

import { NextResponse } from 'next/server';
import { EVENTS } from '@/lib/data/events';
import { heatTicker } from '@/lib/heat/score';
import { newsSeries } from '@/lib/heat/server/news';
import { pooled, wikipediaSeries } from '@/lib/heat/server/wikipedia';
import type { HeatSeries, HeatSourceId, HeatTicker } from '@/lib/heat/types';
import titles from '@/lib/heat/wikiTitles.json';
import { placeForEvent, placeIndex, type Place } from '@/lib/vibe/places';
import { feedIndex } from '@/lib/vibe/server/feedIndex';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TITLES = titles as Record<string, { lang: string; title: string }>;
const HORIZON_DAYS = 60;
let places: Place[] | null = null;

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const country = (params.get('country') ?? '').toUpperCase();
  if (country && !/^[A-Z]{2}$/.test(country)) return NextResponse.json({ error: 'country must be a two-letter code' }, { status: 400 });
  const limit = Math.max(1, Math.min(30, Number(params.get('limit')) || 12));

  const now = Date.now();
  const today = iso(now);
  // Pageviews land a day late; the window ends yesterday and covers four weeks.
  const to = iso(now - 86_400_000);
  const from = iso(now - 28 * 86_400_000);
  const horizon = iso(now + HORIZON_DAYS * 86_400_000);

  const subjects = EVENTS.filter((event) => event.end >= today && event.start <= horizon && (!country || event.countryCode === country));
  places ??= placeIndex(EVENTS);
  const news = await feedIndex(places);

  const tickers = await pooled(subjects, 6, async (event): Promise<HeatTicker> => {
    const series: HeatSeries[] = [];
    const expected: HeatSourceId[] = [];
    const mapped = TITLES[event.id];
    if (mapped) {
      expected.push('wikipedia');
      const wiki = await wikipediaSeries(mapped.lang, mapped.title, from, to);
      if (wiki) series.push(wiki);
    }
    if (news.status.state !== 'unavailable') {
      expected.push('news');
      const place = placeForEvent(event, places!);
      series.push(newsSeries(place ? news.byPlace.get(place.key) ?? [] : [], from, to, news.status.since));
    }
    // On now counts in full; the further out, the cooler, down to 40%.
    const until = Math.max(0, (Date.parse(`${event.start}T00:00:00Z`) - now) / 86_400_000);
    const proximity = 1 - 0.6 * Math.min(1, until / HORIZON_DAYS);
    return heatTicker({ id: `event:${event.id}`, name: event.name, countryCode: event.countryCode, kind: 'event', proximity }, series, expected);
  });

  const items = tickers.filter((ticker) => ticker.madeCut).sort((a, b) => b.heat - a.heat).slice(0, limit);
  return NextResponse.json(
    {
      items,
      considered: subjects.length,
      sources: { wikipedia: Object.keys(TITLES).length ? 'ok' : 'unmapped', news: news.status.state },
      note: 'Heat is measured movement: Wikipedia views of the event’s article and mentions in the dope.travel news intake, last 7 days against the 3 weeks before.',
    },
    { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400' } },
  );
}
