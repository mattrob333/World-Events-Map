import type { Fetcher, Stat } from './types';
import { getJSON, num, OPEN_METEO, openMeteoUrl, round, unitParams } from './http';

/** Fallback for places without a specific conditions type: temperature, high and low, rain chance. */
export const fetchWeather: Fetcher = async (a, { units, now }) => {
  const d = await getJSON<{
    current?: { temperature_2m?: number | null };
    daily?: {
      temperature_2m_max?: (number | null)[];
      temperature_2m_min?: (number | null)[];
      precipitation_probability_max?: (number | null)[];
    };
  }>(
    openMeteoUrl('forecast', {
      latitude: a.lat,
      longitude: a.lng,
      current: 'temperature_2m',
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      forecast_days: 1,
      timezone: 'auto',
      ...unitParams(units),
    }),
  );
  const tU = units === 'imperial' ? '°F' : '°C';
  const t = num(d.current?.temperature_2m);
  const hi = num(d.daily?.temperature_2m_max?.[0]);
  const lo = num(d.daily?.temperature_2m_min?.[0]);
  const rain = num(d.daily?.precipitation_probability_max?.[0]);
  const stats: Stat[] = [];
  if (t !== null) stats.push({ label: 'Now', value: String(round(t)), unit: tU });
  if (hi !== null && lo !== null) stats.push({ label: 'High / low', value: `${round(hi)} / ${round(lo)}`, unit: tU });
  if (rain !== null) stats.push({ label: 'Rain chance', value: String(round(rain)), unit: '%' });
  if (!stats.length) return null;
  return { kind: 'weather', stats, good: null, basis: 'Modeled', sources: [OPEN_METEO], updatedAt: now.toISOString() };
};
