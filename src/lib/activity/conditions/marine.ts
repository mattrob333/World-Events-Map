import type { Fetcher, Stat, Units } from './types';
import { getJSON, num, OPEN_METEO_MARINE, openMeteoUrl, round } from './http';

interface Resp {
  current?: { wave_height?: number | null; wave_period?: number | null; wave_direction?: number | null };
}

const FT_PER_M = 3.281;
const DIRS = ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'];

/** Eight-point compass direction as a word: 158 -> "South". */
export function compassWord(deg: number): string {
  return DIRS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

/** How a direction reads in a sentence: 158 -> "From the south". */
export function fromDirection(deg: number): string {
  return `From the ${compassWord(deg).toLowerCase()}`;
}

/** Wave height as shown: whole feet (tenths below 1 ft), or metres to one decimal. */
export function waveHeight(heightM: number, units: Units): { value: number; unit: 'ft' | 'm' } {
  if (units === 'imperial') {
    const ft = heightM * FT_PER_M;
    return { value: ft >= 1 ? round(ft) : round(ft, 1), unit: 'ft' };
  }
  return { value: round(heightM, 1), unit: 'm' };
}

/**
 * Surf size bands, on the height as shown. Feet for imperial, metres for metric.
 * The lower bound of each band is inclusive.
 */
const SIZE_BANDS: Record<Units, { min: number; words: string }[]> = {
  imperial: [
    { min: 10, words: 'huge, experts only' },
    { min: 5, words: 'big, for experienced surfers' },
    { min: 3, words: 'fun for most surfers' },
    { min: 2, words: 'small, good for beginners' },
    { min: 0, words: 'flat, better for a swim' },
  ],
  metric: [
    { min: 3, words: 'huge, experts only' },
    { min: 1.5, words: 'big, for experienced surfers' },
    { min: 0.9, words: 'fun for most surfers' },
    { min: 0.6, words: 'small, good for beginners' },
    { min: 0, words: 'flat, better for a swim' },
  ],
};

/** Period quality: under 8 s is choppy wind swell, 8 to 11 s is okay, 12 s and up is long, clean swell. */
export function periodQuality(periodS: number): 'choppy' | 'okay' | 'clean' {
  if (periodS < 8) return 'choppy';
  if (periodS < 12) return 'okay';
  return 'clean';
}

const PERIOD_WORDS = { choppy: 'choppy wind swell', okay: '', clean: 'long, clean swell' } as const;

/**
 * One plain line on what the surf numbers mean.
 *   "7 ft at 8 s: big, for experienced surfers."
 *   "4 ft at 14 s: long, clean swell, fun for most surfers."
 *   "1 ft: flat, better for a swim."
 * Undefined without a wave height.
 */
export function explainSurf(heightM: number | null, periodS: number | null, units: Units): string | undefined {
  if (heightM === null || !Number.isFinite(heightM) || heightM < 0) return undefined;
  const { value, unit } = waveHeight(heightM, units);
  const band = SIZE_BANDS[units].find((b) => value >= b.min)!;
  if (value === 0) return 'Flat, better for a swim.';
  const size = `${value} ${unit}`;
  const isFlat = band.min === 0;
  if (isFlat || periodS === null || !Number.isFinite(periodS) || periodS <= 0) return `${size}: ${band.words}.`;
  const p = round(periodS);
  const q = PERIOD_WORDS[periodQuality(p)];
  return `${size} at ${p} s: ${q ? `${q}, ` : ''}${band.words}.`;
}

/** Good surf right now: 3 to 13 ft (1 to 4 m) at 10 s or longer. */
function goodSurf(h: number | null, p: number | null, units: Units): string | null {
  if (h === null || p === null || h < 1 || h > 4 || p < 10) return null;
  const { value, unit } = waveHeight(h, units);
  return `${units === 'imperial' ? round(value) : value} ${unit} waves at ${round(p)} s`;
}

/** Surf: wave height, period, direction from the Open-Meteo Marine API (model output). */
export const fetchMarine: Fetcher = async (a, { units, now }) => {
  const d = await getJSON<Resp>(
    openMeteoUrl('marine', {
      latitude: a.lat,
      longitude: a.lng,
      current: 'wave_height,wave_period,wave_direction',
      timezone: 'auto',
    }),
  );
  const c = d.current;
  if (!c) return null;
  const h = num(c.wave_height), p = num(c.wave_period), dir = num(c.wave_direction);
  if (h === null && p === null) return null; // inland grid cell or no model coverage
  const stats: Stat[] = [];
  if (h !== null) {
    const { value, unit } = waveHeight(h, units);
    if (value > 0) stats.push({ label: 'Waves', value: String(value), unit });
  }
  if (p !== null && round(p) > 0) stats.push({ label: 'Period', value: String(round(p)), unit: 's' });
  if (dir !== null) stats.push({ label: 'From', value: compassWord(dir) });
  if (!stats.length) return null;
  return {
    kind: 'marine',
    stats,
    explain: explainSurf(h, p, units),
    good: goodSurf(h, p, units),
    basis: 'Modeled',
    sources: [OPEN_METEO_MARINE],
    updatedAt: now.toISOString(),
  };
};
