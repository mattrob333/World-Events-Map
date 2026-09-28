import { MONTHS_LONG } from '../activities';
import type { Fetcher, Stat, Units } from './types';
import { getJSON, num, OPEN_METEO, openMeteoUrl, round, unitParams } from './http';

interface Resp {
  current?: { time: string; temperature_2m?: number | null; snow_depth?: number | null };
  daily?: { time: string[]; snowfall_sum: (number | null)[] };
}

/**
 * Snow bands, in inches for imperial and centimetres for metric.
 *   thin:   a base under this is thin cover
 *   powder: this much new snow in 7 days means powder days
 *   fresh:  this much new snow in 7 days is a fresh top-up
 *   trace:  less than this counts as no new snow
 */
export const SNOW_BANDS: Record<Units, { thin: number; powder: number; fresh: number; trace: number }> = {
  imperial: { thin: 12, powder: 12, fresh: 4, trace: 0.5 },
  metric: { thin: 30, powder: 30, fresh: 10, trace: 1 },
};

/** New snow this week that makes the verdict line say "Good now". */
export const GOOD_NEW_SNOW: Record<Units, number> = { imperial: 6, metric: 15 };

/**
 * One plain line on what the snow numbers mean. Both inputs are in the display
 * unit (in or cm); null when unknown.
 *   "14 in of new snow this week: powder days."
 *   "No new snow this week; groomed runs on a 40 in base."
 *   "Thin cover: check which lifts are open."
 */
export function explainSnow(newSnow7d: number | null, depth: number | null, units: Units): string | undefined {
  const b = SNOW_BANDS[units];
  const u = units === 'imperial' ? 'in' : 'cm';
  const base = depth !== null && depth >= b.thin ? ` on a ${round(depth)} ${u} base` : '';
  if (depth !== null && depth < b.thin) return 'Thin cover: check which lifts are open.';
  if (newSnow7d === null) return base ? `Groomed runs${base}.` : undefined;
  const fresh = round(newSnow7d);
  if (newSnow7d >= b.powder) return `${fresh} ${u} of new snow this week: powder days.`;
  if (newSnow7d >= b.fresh) return `${fresh} ${u} of new snow this week: fresh snow${base || ' on the slopes'}.`;
  if (newSnow7d >= b.trace) return `A little new snow this week (${Math.max(1, fresh)} ${u}); mostly groomed runs${base}.`;
  return `No new snow this week; groomed runs${base}.`;
}

/** Ski: snow depth, snowfall, temperature. Open-Meteo model output at about 85% of summit elevation. */
export const fetchSnow: Fetcher = async (a, { units, now }) => {
  const d = await getJSON<Resp>(
    openMeteoUrl('forecast', {
      latitude: a.lat,
      longitude: a.lng,
      elevation: a.elevationFt ? Math.round(a.elevationFt * 0.3048 * 0.85) : undefined,
      current: 'temperature_2m,snow_depth',
      daily: 'snowfall_sum',
      past_days: 7,
      forecast_days: 7,
      timezone: 'auto',
      ...unitParams(units),
    }),
  );
  if (!d.current || !d.daily || !Array.isArray(d.daily.time) || !Array.isArray(d.daily.snowfall_sum)) return null;
  const imp = units === 'imperial';
  const today = String(d.current.time ?? '').slice(0, 10);
  const t = d.daily.time.indexOf(today);
  const falls = d.daily.snowfall_sum.map(num);
  const past = t > 0 ? falls.slice(Math.max(0, t - 7), t) : [];
  const next = t >= 0 ? falls.slice(t, t + 7) : [];
  const sum = (xs: (number | null)[]) => xs.reduce<number>((s, v) => s + (v ?? 0), 0);
  const known = (xs: (number | null)[]) => xs.some((v) => v !== null);
  const pastSum = known(past) ? sum(past) : null;
  const nextSum = sum(next);

  // snow_depth comes in ft with imperial units and m with metric.
  const depthRaw = num(d.current.snow_depth);
  const depth = depthRaw === null ? null : imp ? depthRaw * 12 : depthRaw * 100;
  const temp = num(d.current.temperature_2m);
  const lenU = imp ? 'in' : 'cm';

  const stats: Stat[] = [];
  if (depth !== null && depth >= 0.5) stats.push({ label: 'Snow depth', value: String(round(depth)), unit: lenU });
  if (known(next) && nextSum >= 0.1) stats.push({ label: 'Next 7 days', value: String(round(nextSum, nextSum < 10 ? 1 : 0)), unit: lenU });
  if (temp !== null) stats.push({ label: 'Temperature', value: String(round(temp)), unit: imp ? '°F' : '°C' });

  const note = known(next) && nextSum < 0.1 ? 'No snow in the next 7 days.' : undefined;
  if (!stats.length && !note) return null;
  const good =
    pastSum !== null && pastSum >= GOOD_NEW_SNOW[units] && depth !== null && depth > 0
      ? `${round(pastSum)} ${lenU} of new snow this week`
      : null;
  return {
    kind: 'snow',
    stats,
    note,
    // Real fresh snow is news in any month; otherwise, out of season, say when to look again.
    explain: (good ? undefined : offSeasonLine(a, now)) ?? explainSnow(pastSum, depth, units),
    good,
    basis: 'Modeled',
    sources: [OPEN_METEO],
    updatedAt: now.toISOString(),
  };
};

/**
 * Out of season, depth and snowfall say little ("thin cover" at a closed
 * resort misleads): say when it's worth checking again instead.
 */
export function offSeasonLine(a: { bestMonths: number[] }, now: Date): string | undefined {
  const month = now.getMonth() + 1;
  if (!a.bestMonths.length || a.bestMonths.includes(month)) return undefined;
  for (let i = 1; i <= 12; i++) {
    const m = ((month - 1 + i) % 12) + 1;
    if (a.bestMonths.includes(m)) return `Off season. Check back in ${MONTHS_LONG[m - 1]}, when the season starts.`;
  }
  return undefined;
}
