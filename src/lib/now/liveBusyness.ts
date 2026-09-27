import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { refundSharedNamed, takeShared, takeSharedNamed } from '@/lib/designer/server/sharedBudget';

const ENDPOINT = 'https://besttime.app/api/v1/forecasts/live';
const TTL_MS = 5 * 60 * 1000;
/** A place that just failed isn't asked about again for two minutes (each ask costs a credit). */
const FAILED_TTL_MS = 2 * 60 * 1000;
/** A daily call count from the environment (a whole number above zero), else the fallback. */
export function dailyCalls(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}
/** One member's share of the day's live checks, so no one can use up everyone's. */
const memberCap = () => dailyCalls('BESTTIME_LIVE_MEMBER_DAILY_CALLS', 20);
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

/** `member`: this member's own share ran out (another member may still ask); `site`: the day's cap for everyone. */
export class LiveBudgetError extends Error {
  constructor(message: string, readonly scope: 'member' | 'site' = 'site') {
    super(message);
  }
}

const cache = new Map<string, { at: number; reading: LiveBusyness | null }>();
/** Taps on the same place at once share one paid call. */
const pending = new Map<string, Promise<LiveBusyness | null>>();

const utcDay = (now: number) => new Date(now).toISOString().slice(0, 10);

/** The tokens' own secret when set; else the BestTime key, so tokens keep working until it's added. */
const tokenSecret = () => process.env.NOW_TOKEN_SECRET || process.env.BESTTIME_API_KEY_PRIVATE || '';

/** One key per purpose, so a live token never passes as a place token or the other way round. Fields are JSON, so none can run into the next. */
function sign(purpose: 'live-v1' | 'place-v1', fields: readonly (string | number)[]): string {
  const key = createHmac('sha256', tokenSecret()).update(purpose).digest();
  return createHmac('sha256', key).update(JSON.stringify(fields)).digest('base64url').slice(0, 22);
}

function matches(expected: string, token: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * A token for each place the pulse returned, so the live check only runs on
 * places the server actually showed (today or yesterday, UTC), never on ids
 * someone made up to spend credits.
 */
export function liveToken(venueId: string, now = Date.now()): string {
  return sign('live-v1', [venueId, utcDay(now)]);
}

export function validLiveToken(venueId: string, token: unknown, now = Date.now()): boolean {
  if (typeof token !== 'string' || token.length !== 22 || !tokenSecret()) return false;
  return [now, now - 24 * 60 * 60 * 1000].some((at) => matches(liveToken(venueId, at), token));
}

/** What the place card may look up, exactly as the pulse returned it. */
export type SignedPlace = { id: string; name: string; address?: string; lat: number; lng: number };

/** Like the live token, over the name, address and point too, so a lookup can't be pointed at another place. */
export function placeToken(place: SignedPlace, now = Date.now()): string {
  return sign('place-v1', [place.id, place.name, place.address ?? '', place.lat.toFixed(5), place.lng.toFixed(5), utcDay(now)]);
}

export function validPlaceToken(place: SignedPlace, token: unknown, now = Date.now()): boolean {
  if (typeof token !== 'string' || token.length !== 22 || !tokenSecret()) return false;
  return [now, now - 24 * 60 * 60 * 1000].some((at) => matches(placeToken(place, at), token));
}

/** Ledger pool names are letters only: a member's id, hashed and spelled in letters. */
export function memberPool(memberId: string, prefix = 'liveM'): string {
  const hex = createHash('sha256').update(memberId).digest('hex').slice(0, 30);
  return `${prefix}${hex.replace(/[0-9]/g, (digit) => 'ghijklmnop'[Number(digit)])}`;
}

/** One member's daily share of a paid provider: taken before a call, given back when the call never went ahead. */
export type MemberCharge = { take(): Promise<boolean>; refund(): Promise<void> };

export function memberCharge(memberId: string, prefix: string, cap: number): MemberCharge {
  const pool = memberPool(memberId, prefix);
  return { take: () => takeSharedNamed(pool, cap), refund: () => refundSharedNamed(pool) };
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
 * shared by every server instance. Taps on the same place at once share one
 * call, charged to the member who started it.
 */
export async function liveBusyness(venueId: string, memberId: string): Promise<LiveBusyness | null> {
  const key = process.env.BESTTIME_API_KEY_PRIVATE;
  if (!key || !validVenueId(venueId)) return null;
  for (;;) {
    const hit = cache.get(venueId);
    if (hit && Date.now() - hit.at < (hit.reading ? TTL_MS : FAILED_TTL_MS)) return hit.reading;
    const running = pending.get(venueId);
    if (!running) break;
    try {
      return await running;
    } catch (cause) {
      // Another member's own share ran out, not this one's: ask on this member's behalf.
      if (!(cause instanceof LiveBudgetError && cause.scope === 'member')) throw cause;
    }
  }
  const call = (async () => {
    const charge = memberCharge(memberId, 'liveM', memberCap());
    if (!(await charge.take())) throw new LiveBudgetError('You’ve used today’s live checks.', 'member');
    if (!(await takeShared('bestTimeLive'))) {
      // The site is at its cap: the member's own share isn't spent on a check that never ran.
      await charge.refund();
      throw new LiveBudgetError('Live checks are at today’s limit.');
    }
    try {
      const params = new URLSearchParams({ api_key_private: key, venue_id: venueId });
      const response = await fetch(`${ENDPOINT}?${params.toString()}`, { method: 'POST', signal: AbortSignal.timeout(6000), cache: 'no-store' });
      return remember(venueId, response.ok ? parseLive(venueId, await response.json()) : null);
    } catch {
      return remember(venueId, null);
    }
  })().finally(() => pending.delete(venueId));
  pending.set(venueId, call);
  return call;
}
