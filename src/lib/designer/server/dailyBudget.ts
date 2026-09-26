/**
 * Daily spend caps for paid (or quota-limited) upstream providers used by the
 * designer, research and MCP routes: Treg research, Treg flights, Jev
 * (TypeSafe), the Ticketmaster/SeatGeek event feeds, voice sessions and the
 * designer's Anthropic calls.
 *
 * How it works: every upstream request reserves its worst-case cost (Treg's
 * per-call ceiling, or one unit for count-based pools) BEFORE it is sent,
 * against the shared day total, not a per-request slice. Reservations are
 * synchronous, so concurrent requests on one instance can never together pass
 * the cap. After the call, `settle` swaps the reservation for the real charge
 * when the provider reported one and for the full ceiling when it did not
 * (a missing cost header, a timeout, a thrown error: we assume we were billed).
 *
 * Scope: these ledgers live in process memory, one per serverless instance.
 * They are the fast first check. Paid call sites go through sharedBudget.ts,
 * which also claims against the durable per-pool, per-UTC-day ledger from
 * migration 008, so the cap holds across instances (and fails closed in
 * production when that ledger can't be reached).
 *
 * The day rolls over at 00:00 UTC.
 */

export type BudgetPool = 'research' | 'researchPlace' | 'researchFlights' | 'jev' | 'eventFeeds' | 'voice' | 'designerAi';

type PoolConfig = { env: string; unit: 'usd' | 'calls'; fallback: number };

/** Defaults are deliberately small; raise them with the env vars below. */
const POOLS: Record<BudgetPool, PoolConfig> = {
  /** Every Treg research dollar, place and flights together. */
  research: { env: 'TREG_RESEARCH_DAILY_USD', unit: 'usd', fallback: 2 },
  /** Flights' own share of the research total (the rest goes to place research). */
  researchFlights: { env: 'TREG_FLIGHTS_DAILY_USD', unit: 'usd', fallback: 0.4 },
  /** Derived: research total minus the flights share. */
  researchPlace: { env: '', unit: 'usd', fallback: 0 },
  /** Jev (TypeSafe) calls from the designer: persona, scene and concert fit. */
  jev: { env: 'JEV_DESIGNER_DAILY_CALLS', unit: 'calls', fallback: 400 },
  /** Ticketmaster + SeatGeek requests (Ticketmaster's free quota is 5,000/day). */
  eventFeeds: { env: 'EVENT_FEED_DAILY_CALLS', unit: 'calls', fallback: 2000 },
  /** OpenAI Realtime voice sessions (each capped at a few minutes of audio). */
  voice: { env: 'VOICE_DAILY_SESSIONS', unit: 'calls', fallback: 60 },
  /** Anthropic calls from the designer: profile sorting and itinerary curation. */
  designerAi: { env: 'DESIGNER_AI_DAILY_CALLS', unit: 'calls', fallback: 150 },
};

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

const toMicro = (usd: number) => Math.round(usd * 1_000_000);

/** The pool's daily cap, in micro-USD for USD pools and in calls otherwise. Read at call time so env changes apply. */
export function dailyCap(pool: BudgetPool): number {
  if (pool === 'researchPlace') return Math.max(0, dailyCap('research') - dailyCap('researchFlights'));
  if (pool === 'researchFlights') return Math.min(dailyCap('research'), toMicro(readNumber(POOLS.researchFlights.env, POOLS.researchFlights.fallback)));
  const config = POOLS[pool];
  const value = readNumber(config.env, config.fallback);
  return config.unit === 'usd' ? toMicro(value) : Math.floor(value);
}

type Ledger = { day: string; spent: number; reserved: number };
const ledgers = new Map<BudgetPool, Ledger>();

const dayOf = (now: number) => new Date(now).toISOString().slice(0, 10);

function ledger(pool: BudgetPool, now: number): Ledger {
  const day = dayOf(now);
  let current = ledgers.get(pool);
  if (!current) {
    current = { day, spent: 0, reserved: 0 };
    ledgers.set(pool, current);
  } else if (current.day !== day) {
    // New UTC day: spending resets, calls still in flight stay reserved.
    current.day = day;
    current.spent = 0;
  }
  return current;
}

export type Reservation = {
  readonly amount: number;
  /** Replace the reservation with the real charge; `null` (unknown) charges the full reservation. */
  settle(actual: number | null): void;
};

/**
 * Reserve `amount` against every listed pool at once, or nothing at all.
 * Returns null when any pool would pass its cap.
 */
export function reserve(pools: BudgetPool[], amount: number, now = Date.now()): Reservation | null {
  if (!(amount >= 0) || !Number.isFinite(amount)) return null;
  const books = pools.map((pool) => ({ book: ledger(pool, now), cap: dailyCap(pool) }));
  if (books.some(({ book, cap }) => book.spent + book.reserved + amount > cap)) return null;
  for (const { book } of books) book.reserved += amount;
  let settled = false;
  return {
    amount,
    settle(actual) {
      if (settled) return;
      settled = true;
      const charge = actual !== null && Number.isFinite(actual) && actual >= 0 ? actual : amount;
      // Same ledger objects as at reservation time. If the UTC day rolled over
      // mid-call, the charge lands on the new day (the conservative side).
      for (const { book } of books) {
        book.reserved = Math.max(0, book.reserved - amount);
        book.spent += charge;
      }
    },
  };
}

/** Count-based pools: take `units` now, with no refund. */
export function take(pool: BudgetPool, units = 1, now = Date.now()): boolean {
  const reservation = reserve([pool], units, now);
  reservation?.settle(units);
  return reservation !== null;
}

/** Units left today in a pool (cap minus spent and reserved). */
export function remaining(pool: BudgetPool, now = Date.now()): number {
  const book = ledger(pool, now);
  return Math.max(0, dailyCap(pool) - book.spent - book.reserved);
}

export function budgetSnapshot(pool: BudgetPool, now = Date.now()): { cap: number; spent: number; reserved: number } {
  const book = ledger(pool, now);
  return { cap: dailyCap(pool), spent: book.spent, reserved: book.reserved };
}

export function resetDailyBudgetsForTests() {
  ledgers.clear();
}
