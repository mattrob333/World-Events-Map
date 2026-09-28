import 'server-only';
import type { Activity } from '../activities';
import type { ConditionsKindName, Fetcher } from './types';
import { fetchSnow } from './snow';
import { fetchMarine } from './marine';
import { fetchBeach } from './beach';
import { fetchAurora } from './aurora';
import { fetchEvent } from './event';
import { fetchWeather } from './weather';

/**
 * Live conditions for an activity, fetched on the server. The card reads them from
 * GET /api/activity-conditions; client code imports only the types in `./types`.
 */

export type { Conditions, ConditionsKindName, FetchContext, Fetcher, Stat, Units } from './types';
export { compassWord, explainSurf, fromDirection, periodQuality, waveHeight } from './marine';
export { explainSnow, SNOW_BANDS } from './snow';
export { explainAurora, AURORA_BANDS } from './aurora';
export { explainBeach, uvAdvice, BEACH_BANDS } from './beach';

export const FETCHERS: Record<ConditionsKindName, Fetcher> = {
  snow: fetchSnow,
  marine: fetchMarine,
  beach: fetchBeach,
  aurora: fetchAurora,
  event: fetchEvent,
  weather: fetchWeather,
};

export function conditionsKind(a: Activity): ConditionsKindName {
  return a.conditions ?? 'weather';
}

export function fetcherFor(a: Activity): Fetcher {
  return FETCHERS[conditionsKind(a)];
}
