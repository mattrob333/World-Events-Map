import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { takeShared, takeSharedNamed } from '@/lib/designer/server/sharedBudget';

const ENDPOINT = 'https://besttime.app/api/v1/forecasts/live';
const TTL_MS = 5 * 60 * 1000;
/** A place that just failed isn't asked about again for two minutes (each ask costs a credit). */
const FAILED_TTL_MS = 2 * 60 * 1000;
/** One member's share of the day's live checks, so no one can use up everyone's. */
const memberCap = () => {
  const raw = Number(process.env.BESTTIME_LIVE_MEMBER_DAILY_CALLS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 60;
};
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

const cache = new Map<string, { at: number; reading: LiveBusyness | null }>();

const utcDay = (now: number) => new Date(now).toISOString().slice(0, 10);

function sign(venueId: string, day: string): string {
  return createHmac('sha256', process.env.BESTTIME_API_KEY_PRIVATE ?? '').update(`live:${venueId}:${day}`).digest('base64url').slice(0, 22);
}

/**
 * A token for each place the pulse returned, so the live check only runs on
 * places the server actually showed (today or yesterday, UTC), never on ids
 * someone made up to spend credits.
 */
export function liveToken(venueId: string, now = Date.now()): string {
  return sign(venueId, utcDay(now));
}

export function validLiveToken(venueId: string, token: unknown, now = Date.now()): boolean {
  if (typeof token !== 'string' || token.length !== 22 || !process.env.BESTTIME_API_KEY_PRIVATE) return false;
  return [now, now - 24 * 60 * 60 * 1000].some((at) => {
    const expected = Buffer.from(sign(venueId, utcDay(at)));
    const given = Buffer.from(token);
    return expected.length === given.length && timingSafeEqual(expected, given);
  });
}

/** Ledger pool names are letters only: a member's id, hashed and spelled in letters. */
export function memberPool(memberId: string): string {
  const hex = createHash('sha256').update(memberId).digest('hex').slice(0, 30);
  return `liveM${hex.replace(/[0-9]/g, (digit) => 'ghijklmnop'[Number(digit)])}`;
}

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

function remember(venueId: string, reading: LiveBusyness | null) {
  if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  cache.set(venueId, { at: Date.now(), reading });
  return reading;
}

/**
 * One live lookup per place per five minutes (a failure is remembered for
 * two), within the member's own daily share and the site's daily cap, both
 * shared by every server instance.
 */
export async function liveBusyness(venueId: string, memberId: string): Promise<LiveBusyness | null> {
  const key = process.env.BESTTIME_API_KEY_PRIVATE;
  if (!key || !validVenueId(venueId)) return null;
  const hit = cache.get(venueId);
  if (hit && Date.now() - hit.at < (hit.reading ? TTL_MS : FAILED_TTL_MS)) return hit.reading;
  if (!(await takeSharedNamed(memberPool(memberId), memberCap()))) throw new LiveBudgetError('You’ve used today’s live checks.');
  if (!(await takeShared('bestTimeLive'))) throw new LiveBudgetError('Live checks are at today’s limit.');
  try {
    const params = new URLSearchParams({ api_key_private: key, venue_id: venueId });
    const response = await fetch(`${ENDPOINT}?${params.toString()}`, { method: 'POST', signal: AbortSignal.timeout(6000), cache: 'no-store' });
    return remember(venueId, response.ok ? parseLive(venueId, await response.json()) : null);
  } catch {
    return remember(venueId, null);
  }
}
