import 'server-only';
import type { HeatSeries } from '../types';

/**
 * Wikimedia per-article daily views (human traffic only). Free, no key; we
 * identify ourselves as their rules ask and keep well under their limits:
 * results are cached for six hours and fetched a few at a time.
 */

const UA = 'dope.travel-heat/1.0 (https://dope.travel)';
const TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; series: HeatSeries | null }>();

const ymd = (iso: string) => iso.replace(/-/g, '');

export async function wikipediaSeries(lang: string, title: string, from: string, to: string): Promise<HeatSeries | null> {
  const key = `${lang}:${title}:${from}:${to}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.series;
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${encodeURIComponent(`${lang}.wikipedia`)}/all-access/user/${encodeURIComponent(title.replace(/ /g, '_'))}/daily/${ymd(from)}/${ymd(to)}`;
  let series: HeatSeries | null = null;
  try {
    const response = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(6000), next: { revalidate: 21600 } });
    if (response.ok) {
      const body = (await response.json()) as { items?: { timestamp?: string; views?: number }[] };
      const byDay = new Map((body.items ?? []).map((item) => [`${item.timestamp?.slice(0, 4)}-${item.timestamp?.slice(4, 6)}-${item.timestamp?.slice(6, 8)}`, typeof item.views === 'number' ? item.views : null]));
      const days: HeatSeries['days'] = [];
      for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) {
        const day = new Date(t).toISOString().slice(0, 10);
        days.push({ day, value: byDay.has(day) ? byDay.get(day)! : null });
      }
      series = { source: 'wikipedia', label: `Wikipedia views (${lang})`, absolute: true, unit: 'views', days };
    }
  } catch {
    series = null;
  }
  cache.set(key, { at: Date.now(), series });
  return series;
}

/** Runs tasks a few at a time. */
export async function pooled<T, R>(items: readonly T[], size: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      out[index] = await run(items[index]!);
    }
  }));
  return out;
}
