import 'server-only';
import { BestTimeVenueProvider } from '@/lib/opportunities/besttime';
import type { MemberCharge } from './liveBusyness';
import { NowSearchBudgetError } from './providerBudget';
import type { PulseWhat } from './pulse';
import { claimVenueSearch } from './service';

/** A day's forecast doesn't change within the day: one call per area per day, give or take. */
const TTL_MS = 6 * 60 * 60 * 1000;
const FAILED_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; hourly: Map<string, number[]> | null }>();
/** `memberRefused`: the caller who started it had used their own share, which says nothing about anyone else's. */
const pending = new Map<string, Promise<{ hourly: Map<string, number[]> | null; memberRefused?: boolean }>>();

/** BestTime's day for a local clock: before 6am still belongs to the day before. 0 = Monday. */
export function bestTimeDay(weekday: number, hour: number): number {
  return hour < 6 ? (weekday + 6) % 7 : weekday;
}

/**
 * The usual busyness by hour for the places around a search point, for the
 * Tonight chart: one budgeted BestTime call per area, kind and day, shared by
 * everyone searching there (and charged to the member who started it). Null
 * when it couldn't be had (the chart is then left off, never made up).
 */
export async function hourlyForArea(center: { lat: number; lng: number }, radiusMeters: number, what: PulseWhat, dayInt: number, charge?: MemberCharge): Promise<Map<string, number[]> | null> {
  if (!process.env.BESTTIME_API_KEY_PRIVATE) return null;
  const key = [center.lat.toFixed(2), center.lng.toFixed(2), Math.round(radiusMeters), what, dayInt].join(':');
  for (;;) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < (hit.hourly ? TTL_MS : FAILED_TTL_MS)) return hit.hourly;
    // Many members opening the same area at once share one call.
    const running = pending.get(key);
    if (!running) break;
    const shared = await running;
    if (!shared.memberRefused) return shared.hourly;
  }
  const call = (async () => {
    try {
      await claimVenueSearch(charge);
    } catch (cause) {
      // Out of budget: nothing ran, so nothing is remembered and the next ask tries again.
      return { hourly: null, memberRefused: cause instanceof NowSearchBudgetError && cause.scope === 'member' };
    }
    let hourly: Map<string, number[]> | null = null;
    try {
      const result = await new BestTimeVenueProvider().dayForecast({ location: center, radiusMeters, at: new Date().toISOString(), categories: [what], limit: 50 }, dayInt);
      // Counts only, so the shape BestTime sends can be checked in the logs.
      console.info('[besttime-day] shape', JSON.stringify(result.shape));
      hourly = result.hourly.size ? result.hourly : null;
    } catch {
      hourly = null;
    }
    if (cache.size > 500) cache.delete(cache.keys().next().value as string);
    cache.set(key, { at: Date.now(), hourly });
    return { hourly };
  })().finally(() => pending.delete(key));
  pending.set(key, call);
  return (await call).hourly;
}

export function resetHourlyCacheForTests() {
  cache.clear();
  pending.clear();
}
