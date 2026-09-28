import type { Fetcher, Stat } from './types';
import { getJSON, NOAA_KP_URL, NOAA_SWPC, num, OPEN_METEO, openMeteoUrl, round } from './http';

type KpRow = { time_tag: string; kp: number; observed?: string };

/** Aurora bands. Kp on NOAA's 0 to 9 scale, cloud as percent cover tonight. */
export const AURORA_BANDS = {
  /** Below this Kp the aurora is faint and mostly a camera thing. */
  visibleKp: 3,
  /** At or above this Kp there's a good chance with clear skies. */
  strongKp: 5,
  /** At or below this cloud cover the sky counts as clear. */
  clearCloud: 40,
  /** At or above this cloud cover views are unlikely. */
  cloudyCloud: 70,
} as const;

/** Good aurora conditions right now (feeds the verdict): Kp 4 or more and cloud 40% or less tonight. */
export const GOOD_KP = 4;

/**
 * One plain line on what Kp and cloud mean together.
 *   "Kp 5 and clear skies tonight: a good chance to see it."
 *   "Kp 2: faint, usually only on camera."
 *   "Kp 5 but cloudy tonight: views unlikely."
 * Undefined without a Kp value.
 */
export function explainAurora(kp: number | null, cloud: number | null): string | undefined {
  if (kp === null || !Number.isFinite(kp)) return undefined;
  const k = `Kp ${round(kp, 1)}`;
  const b = AURORA_BANDS;
  if (kp < b.visibleKp) return `${k}: faint, usually only on camera.`;
  const chance = kp >= b.strongKp ? 'a good chance to see it' : 'a fair chance on a dark night';
  if (cloud === null || !Number.isFinite(cloud)) return `${k}: ${chance} if the sky is clear.`;
  if (cloud >= b.cloudyCloud) return `${k} but cloudy tonight: views unlikely.`;
  if (cloud <= b.clearCloud) return `${k} and clear skies tonight: ${chance}.`;
  return `${k} and some cloud tonight: watch for gaps.`;
}

/** Parses NOAA's Kp product: object rows now, a header row plus arrays in older versions. */
export function parseKpRows(raw: unknown): KpRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r): KpRow[] => {
    if (Array.isArray(r)) {
      if (r[0] === 'time_tag') return [];
      return [{ time_tag: String(r[0]), kp: Number(r[1]), observed: String(r[2]) }];
    }
    if (r && typeof r === 'object' && 'time_tag' in r) return [r as KpRow];
    return [];
  });
}

/** Highest Kp from 3 h ago to 24 h ahead, or null. */
export function maxKpNext24h(rows: KpRow[], now: Date): number | null {
  const t0 = now.getTime();
  const ks = rows
    .filter((r) => {
      const t = Date.parse(r.time_tag.endsWith('Z') ? r.time_tag : `${r.time_tag}Z`);
      return t >= t0 - 3 * 3600e3 && t <= t0 + 24 * 3600e3;
    })
    .map((r) => num(r.kp))
    .filter((v): v is number => v !== null);
  return ks.length ? Math.max(...ks) : null;
}

/** Mean cloud cover tonight, 21:00 to 03:00 local, from Open-Meteo hourly data. */
export function cloudTonight(
  hourly: { time: string[]; cloud_cover: (number | null)[] } | undefined,
  utcOffsetSeconds: number,
  now: Date,
): number | null {
  if (!hourly || !Array.isArray(hourly.time) || !Array.isArray(hourly.cloud_cover)) return null;
  const { time, cloud_cover } = hourly;
  const localNow = new Date(now.getTime() + utcOffsetSeconds * 1000).toISOString().slice(0, 13);
  const from = Math.max(0, time.findIndex((t) => t >= localNow));
  const vals: number[] = [];
  for (let i = from; i < time.length && vals.length < 7; i++) {
    const h = Number(time[i].slice(11, 13));
    const v = num(cloud_cover[i]);
    if (h >= 21 || h <= 3) {
      if (v !== null) vals.push(v);
    } else if (vals.length) break;
  }
  return vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : null;
}

/** Aurora: NOAA SWPC planetary Kp forecast (next 24 h max) and Open-Meteo cloud cover tonight. */
export const fetchAurora: Fetcher = async (a, { now, onUpstreamError }) => {
  let failures = 0;
  const soft = <T>(p: Promise<T>) =>
    p.catch(() => {
      failures += 1;
      return null;
    });
  const [kpRaw, wx] = await Promise.all([
    soft(getJSON<unknown>(NOAA_KP_URL)),
    soft(
      getJSON<{ hourly?: { time: string[]; cloud_cover: (number | null)[] }; utc_offset_seconds?: number }>(
        openMeteoUrl('forecast', {
          latitude: a.lat,
          longitude: a.lng,
          hourly: 'cloud_cover',
          forecast_days: 2,
          timezone: 'auto',
        }),
      ),
    ),
  ]);
  if (failures === 2) throw new Error('aurora upstreams failed');
  if (failures) onUpstreamError?.();

  const kp = maxKpNext24h(parseKpRows(kpRaw), now);
  const cloud = cloudTonight(wx?.hourly, num(wx?.utc_offset_seconds) ?? 0, now);
  const stats: Stat[] = [];
  // Kp 0 is a real reading (a quiet sky), so it stays.
  if (kp !== null) stats.push({ label: 'Kp next 24 h', value: String(round(kp, 1)) });
  if (cloud !== null) stats.push({ label: 'Clouds tonight', value: String(round(cloud)), unit: '%' });
  if (!stats.length) return null;
  const good =
    kp !== null && cloud !== null && kp >= GOOD_KP && cloud <= AURORA_BANDS.clearCloud
      ? `Kp ${round(kp, 1)} with clear skies tonight`
      : null;
  const sources = [...(kp !== null ? [NOAA_SWPC] : []), ...(cloud !== null ? [OPEN_METEO] : [])];
  return {
    kind: 'aurora',
    stats,
    explain: explainAurora(kp, cloud),
    good,
    basis: kp !== null ? 'Forecast' : 'Modeled',
    sources,
    updatedAt: now.toISOString(),
  };
};
