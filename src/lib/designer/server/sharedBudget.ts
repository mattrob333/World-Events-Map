import { dailyCap, reserve, type BudgetPool, type Reservation } from './dailyBudget';

/**
 * Daily caps shared by every server instance (migration 008), on top of the
 * fast in-memory ledger. The in-memory check runs first, so a busy instance
 * says no without a database round trip; the durable claim then makes the cap
 * true across instances, not `cap × instances`.
 *
 * In production a paid call never goes ahead when the shared ledger can't be
 * reached (fail closed, like the NOW budget). Elsewhere (local development,
 * previews without the database) the in-memory cap alone applies.
 */
const strict = () => process.env.VERCEL_ENV === 'production';

/** Loaded on first use: the database client is server-only, and this module is imported by shared code. */
let durable: Promise<typeof import('@/lib/data/durable') | null> | null = null;
async function database() {
  // One import, shared by concurrent callers.
  durable ??= import('@/lib/data/durable').catch(() => null);
  return (await durable)?.signalDatabase() ?? null;
}

/** A stalled database must not stall every paid request behind it. */
const CLAIM_TIMEOUT_MS = 1500;

async function claim(pool: string, units: number, cap: number): Promise<{ day: string } | 'refused' | 'unavailable'> {
  const unavailable = (why: string) => {
    // Fail-closed must be visible in logs, or it reads like a real daily cap.
    if (strict()) console.error('[budget] shared ledger unavailable; refusing paid call', pool, why);
    return 'unavailable' as const;
  };
  const db = await database();
  if (!db) return unavailable('no database client');
  try {
    const { data, error } = await db
      .rpc('claim_meridian_daily_budget', { p_pool: pool, p_units: Math.ceil(units), p_cap: cap })
      .abortSignal(AbortSignal.timeout(CLAIM_TIMEOUT_MS));
    if (error) return unavailable(error.code ?? 'rpc error');
    return typeof data === 'string' ? { day: data } : 'refused';
  } catch {
    return unavailable('timeout or network');
  }
}

async function refund(pool: BudgetPool, units: number, day: string): Promise<void> {
  if (!(units > 0)) return;
  const db = await database();
  if (!db) return;
  await db.rpc('refund_meridian_daily_budget', { p_pool: pool, p_units: Math.floor(units), p_day: day }).then(() => undefined, () => undefined);
}

/** Count pools: take `units` now, in this instance and in the shared ledger, or not at all. */
export async function takeShared(pool: BudgetPool, units = 1): Promise<boolean> {
  const local = reserve([pool], units);
  if (!local) return false;
  const result = await claim(pool, units, dailyCap(pool));
  const granted = result === 'unavailable' ? !strict() : result !== 'refused';
  // Refused (or down in production): give the units back, so an outage can't lock this instance out for the day.
  local.settle(granted ? units : 0);
  return granted;
}

/**
 * Reserve `amount` in every pool at once (in memory and shared), or nothing.
 * Settling refunds the unused part of the shared claim to the day it was made.
 */
export async function reserveShared(pools: BudgetPool[], amount: number, now = Date.now()): Promise<Reservation | null> {
  const local = reserve(pools, amount, now);
  if (!local) return null;
  const claimed: { pool: BudgetPool; day: string }[] = [];
  for (const pool of pools) {
    const result = await claim(pool, amount, dailyCap(pool));
    if (result === 'unavailable' && !strict()) continue;
    if (result === 'refused' || result === 'unavailable') {
      await Promise.all(claimed.map((entry) => refund(entry.pool, amount, entry.day)));
      local.settle(0);
      return null;
    }
    claimed.push({ pool, day: result.day });
  }
  let settled = false;
  return {
    amount,
    settle(actual) {
      if (settled) return;
      settled = true;
      local.settle(actual);
      const charge = actual !== null && Number.isFinite(actual) && actual >= 0 ? actual : amount;
      const unused = amount - charge;
      // Best effort: if the instance freezes first, the shared ledger over-counts, never under.
      if (unused > 0) void Promise.all(claimed.map((entry) => refund(entry.pool, unused, entry.day)));
    },
  };
}

/** In this instance only: the first line of defence for named pools, before the shared ledger. */
const namedLocal = new Map<string, { day: string; spent: number }>();

/**
 * A named daily pool with its own cap (for example one person's share of a
 * paid provider), counted in this instance and in the shared ledger. Names
 * must be letters only, as the ledger requires.
 */
export async function takeSharedNamed(name: string, cap: number, units = 1, now = Date.now()): Promise<boolean> {
  if (!/^[a-zA-Z]{1,40}$/.test(name) || !(cap > 0)) return false;
  const day = new Date(now).toISOString().slice(0, 10);
  const local = namedLocal.get(name);
  const spent = local?.day === day ? local.spent : 0;
  if (spent + units > cap) return false;
  if (namedLocal.size > 5000) namedLocal.delete(namedLocal.keys().next().value as string);
  namedLocal.set(name, { day, spent: spent + units });
  const result = await claim(name, units, cap);
  const granted = result === 'unavailable' ? !strict() : result !== 'refused';
  if (!granted) namedLocal.set(name, { day, spent });
  return granted;
}
