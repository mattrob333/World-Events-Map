import type { Fetcher, Stat, Units } from './types';
import { getJSON, num, OPEN_METEO, OPEN_METEO_MARINE, openMeteoUrl, round, unitParams } from './http';

/**
 * Beach bands, on whole degrees in the display unit (°F imperial, °C metric).
 * Water: warm, pleasant, cool, else cold. Air: warm enough for the beach, mild, else cool.
 */
export const BEACH_BANDS: Record<Units, { water: { warm: number; pleasant: number; cool: number }; air: { warm: number; mild: number } }> = {
  imperial: { water: { warm: 78, pleasant: 72, cool: 64 }, air: { warm: 75, mild: 65 } },
  metric: { water: { warm: 26, pleasant: 22, cool: 18 }, air: { warm: 24, mild: 18 } },
};

/** UV bands (WHO scale): 8+ very high, 6 to 7 high, 3 to 5 moderate, below 3 left unsaid. */
export function uvAdvice(uv: number | null): string | undefined {
  if (uv === null || !Number.isFinite(uv)) return undefined;
  const u = round(uv);
  if (u >= 8) return `UV ${u}: shade by midday.`;
  if (u >= 6) return `UV ${u}: sunscreen and a hat.`;
  if (u >= 3) return `UV ${u}: wear sunscreen.`;
  return undefined;
}

/**
 * One plain line on air, water and UV, temperatures in the display unit.
 *   "81°F air and 79°F water: warm swimming. UV 9: shade by midday."
 */
export function explainBeach(air: number | null, water: number | null, uv: number | null, units: Units): string | undefined {
  const tU = units === 'imperial' ? '°F' : '°C';
  const b = BEACH_BANDS[units];
  const a = air === null || !Number.isFinite(air) ? null : round(air);
  const w = water === null || !Number.isFinite(water) ? null : round(water);
  let first: string | undefined;
  if (w !== null) {
    const words =
      w >= b.water.warm ? 'warm swimming'
      : w >= b.water.pleasant ? 'pleasant swimming'
      : w >= b.water.cool ? 'cool swimming'
      : 'cold water, a wetsuit helps';
    first = `${a !== null ? `${a}${tU} air and ` : ''}${w}${tU} water: ${words}.`;
  } else if (a !== null) {
    const words = a >= b.air.warm ? 'beach weather' : a >= b.air.mild ? 'mild, better for a walk than a swim' : 'cool for the beach';
    first = `${a}${tU} air: ${words}.`;
  }
  const uvLine = uvAdvice(uv);
  const line = [first, uvLine].filter(Boolean).join(' ');
  return line || undefined;
}

/** Beach: air temperature, water temperature, UV index. */
export const fetchBeach: Fetcher = async (a, { units, now, onUpstreamError }) => {
  const imp = units === 'imperial';
  let failures = 0;
  const soft = <T>(p: Promise<T>) =>
    p.catch(() => {
      failures += 1;
      return null;
    });
  const [w, m] = await Promise.all([
    soft(
      getJSON<{ current?: { temperature_2m?: number | null }; daily?: { uv_index_max?: (number | null)[] } }>(
        openMeteoUrl('forecast', {
          latitude: a.lat,
          longitude: a.lng,
          current: 'temperature_2m',
          daily: 'uv_index_max',
          forecast_days: 1,
          timezone: 'auto',
          ...unitParams(units),
        }),
      ),
    ),
    soft(
      getJSON<{ current?: { sea_surface_temperature?: number | null } }>(
        openMeteoUrl('marine', { latitude: a.lat, longitude: a.lng, current: 'sea_surface_temperature', timezone: 'auto' }),
      ),
    ),
  ]);
  if (failures === 2) throw new Error('beach upstreams failed');
  if (failures) onUpstreamError?.();

  const air = num(w?.current?.temperature_2m);
  // The marine API reports sea surface temperature in °C whatever the unit parameters.
  const sstC = num(m?.current?.sea_surface_temperature);
  const water = sstC === null ? null : imp ? sstC * 1.8 + 32 : sstC;
  const uv = num(w?.daily?.uv_index_max?.[0]);
  const tU = imp ? '°F' : '°C';
  const stats: Stat[] = [];
  if (air !== null) stats.push({ label: 'Air', value: String(round(air)), unit: tU });
  if (water !== null) stats.push({ label: 'Water', value: String(round(water)), unit: tU });
  if (uv !== null && round(uv) > 0) stats.push({ label: 'UV index', value: String(round(uv)) });
  if (!stats.length) return null;
  const warm = imp ? 75 : 24;
  const good =
    air !== null && air >= warm && (water === null || water >= warm)
      ? water !== null
        ? `${round(air)}${tU} air, ${round(water)}${tU} water`
        : `${round(air)}${tU} and sunny season`
      : null;
  const sources = [...(w ? [OPEN_METEO] : []), ...(water !== null ? [OPEN_METEO_MARINE] : [])];
  return {
    kind: 'beach',
    stats,
    explain: explainBeach(air, water, uv, units),
    good,
    basis: 'Modeled',
    sources,
    updatedAt: now.toISOString(),
  };
};
