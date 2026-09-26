import 'server-only';
import { takeShared } from '@/lib/designer/server/sharedBudget';

const ENDPOINT = 'https://besttime.app/api/v1/forecasts/live';
const TTL_MS = 5 * 60 * 1000;
const VENUE_ID = /^[A-Za-z0-9_-]{6,120}$/;

/**
 * BestTime's live reading for one place, the proof behind a beam: how busy
 * it is right now, the usual for this hour, and the difference. `live` is
 * absent when BestTime has no live data for the place; that is said, never
 * filled in from the forecast.
 */
export type LiveBusyness = {
  venueId: string;
  live?: number;
  usual?: number;
  /** Live minus usual, in points; positive means busier than usual. */
  delta?: number;
  /** The hour the reading covers, as BestTime labels it ("9pm–10pm"). */
  hour?: string;
  checkedAt: string;
};

export class LiveBudgetError extends Error {}

const cache = new Map<string, { at: number; reading: LiveBusyness }>();

export const validVenueId = (value: unknown): value is string => typeof value === 'string' && VENUE_ID.test(value);

const whole = (value: unknown, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : undefined;

/** Reads BestTime's live response. Exported for tests. */
export function parseLive(venueId: string, body: unknown, now = new Date()): LiveBusyness | null {
  const root = body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  if (!root || root.status !== 'OK') return null;
  const analysis = root.analysis && typeof root.analysis === 'object' ? (root.analysis as Record<string, unknown>) : {};
  const hasLive = analysis.venue_live_busyness_available === true;
  const hasUsual = analysis.venue_forecast_busyness_available !== false;
  const live = hasLive ? whole(analysis.venue_live_busyness, 0, 200) : undefined;
  const usual = hasUsual ? whole(analysis.venue_forecasted_busyness, 0, 100) : undefined;
  const delta = live !== undefined ? whole(analysis.venue_live_forecasted_delta, -200, 200) ?? (usual !== undefined ? live - usual : undefined) : undefined;
  const start = typeof analysis.hour_start_12 === 'string' ? analysis.hour_start_12.slice(0, 8) : '';
  const end = typeof analysis.hour_end_12 === 'string' ? analysis.hour_end_12.slice(0, 8) : '';
  return { venueId, ...(live !== undefined ? { live } : {}), ...(usual !== undefined ? { usual } : {}), ...(delta !== undefined ? { delta } : {}), ...(start && end ? { hour: `${start}–${end}` } : {}), checkedAt: now.toISOString() };
}

/** One live lookup per place per five minutes, within a daily cap shared by every server instance. */
export async function liveBusyness(venueId: string): Promise<LiveBusyness | null> {
  const key = process.env.BESTTIME_API_KEY_PRIVATE;
  if (!key || !validVenueId(venueId)) return null;
  const hit = cache.get(venueId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.reading;
  if (!(await takeShared('bestTimeLive'))) throw new LiveBudgetError('Live checks are at today’s limit.');
  const params = new URLSearchParams({ api_key_private: key, venue_id: venueId });
  const response = await fetch(`${ENDPOINT}?${params.toString()}`, { method: 'POST', signal: AbortSignal.timeout(6000), cache: 'no-store' });
  if (!response.ok) return null;
  const reading = parseLive(venueId, await response.json());
  if (!reading) return null;
  if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  cache.set(venueId, { at: Date.now(), reading });
  return reading;
}
