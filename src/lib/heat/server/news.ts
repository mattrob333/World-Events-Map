import 'server-only';
import type { Mention } from '@/lib/vibe/match';
import type { HeatSeries } from '../types';

/** Mentions per day for one place, from the news index (last 30 days). Days before the library began are gaps. */
export function newsSeries(mentions: readonly Mention[], from: string, to: string, since: string | null): HeatSeries {
  const counts = new Map<string, number>();
  for (const mention of mentions) {
    const day = mention.publishedAt.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  const start = since ? since.slice(0, 10) : to;
  const days: HeatSeries['days'] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) {
    const day = new Date(t).toISOString().slice(0, 10);
    days.push({ day, value: day < start ? null : counts.get(day) ?? 0 });
  }
  return { source: 'news', label: 'News mentions (dope.travel intake)', absolute: true, unit: 'mentions', days };
}
