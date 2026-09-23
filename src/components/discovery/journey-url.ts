import type { TripInterest, TripSeason } from '@/lib/discovery/seasonal';

const SEASONS: readonly TripSeason[] = ['all', 'winter', 'spring', 'summer', 'fall'];
const INTERESTS: readonly TripInterest[] = ['all', 'ski', 'coast', 'adventure', 'culture'];

export interface DiscoveryState {
  season: TripSeason;
  interest: TripInterest;
  journey: string | null;
}

/**
 * The home page keeps its season, interest and chosen journey in the URL so
 * refresh restores them and browser Back steps out of a journey instead of
 * leaving MERIDIAN (red team UFR-A06, B05).
 */
export function readDiscoveryState(params: Pick<URLSearchParams, 'get'>): DiscoveryState {
  const season = params.get('season');
  const interest = params.get('interest');
  const journey = params.get('journey');
  return {
    season: SEASONS.find((value) => value === season) ?? 'all',
    interest: INTERESTS.find((value) => value === interest) ?? 'all',
    journey: journey && /^[a-z0-9-]{1,100}$/.test(journey) ? journey : null,
  };
}

/** Returns `?…` for the next state, keeping unrelated params such as `event`. */
export function discoveryQuery(current: URLSearchParams, next: Partial<DiscoveryState>): string {
  const params = new URLSearchParams(current.toString());
  const state = { ...readDiscoveryState(current), ...next };
  const set = (key: string, value: string | null, fallback: string | null) => {
    if (value === null || value === fallback) params.delete(key);
    else params.set(key, value);
  };
  set('season', state.season, 'all');
  set('interest', state.interest, 'all');
  set('journey', state.journey, null);
  const query = params.toString();
  return query ? `?${query}` : '?';
}
