/**
 * Deterministic trip scheduler. Fits the places a traveler kept (restaurants,
 * bars, sights, activities, events) into a time-blocked, day-by-day plan
 * without an LLM.
 *
 * Pure: no clock, no randomness, no I/O. The same input always produces a
 * byte-identical result. All times are local wall-clock minutes; weekday math
 * is done from the ISO date at UTC noon so the host timezone never leaks in.
 *
 * Pipeline:
 *   1. Normalise and validate picks (dedupe ids, defaults, clamps).
 *   2. Place fixed-time items at their exact start.
 *   3. Cluster flexible picks per day: seed with the highest-priority located
 *      pick, then grow with nearest neighbours (haversine) up to the pace,
 *      leaving far-away picks (beyond ~15 travel minutes) to seed later days.
 *      Picks without coords fill the days with the most room left.
 *   4. Per day, place meals near their classic time, then activities in
 *      nearest-neighbour order from lodging (or the day's first stop), at the
 *      earliest feasible start, or the quietest one when busyness data exists.
 *   5. Retry anything that did not fit on every other day; whatever still
 *      cannot fit is reported in `unscheduled` with a plain-English reason.
 */

import { SLOT_META, type SlotKind } from './catalog';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PickKind = 'breakfast' | 'lunch' | 'dinner' | 'drinks' | 'nightlife' | 'sight' | 'activity' | 'event';

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type SchedulePick = {
  id: string;
  name: string;
  kind: PickKind;
  /** Optional; missing coords = unknown location. */
  lat?: number;
  lng?: number;
  /** Defaults per kind (see DEFAULT_DURATION_MIN). */
  durationMin?: number;
  /** Opening windows per weekday 0=Sun..6=Sat, "HH:MM-HH:MM" (may cross midnight like "22:00-03:00"). Missing = unknown, assume typical hours for the kind. */
  hours?: Partial<Record<Weekday, string[]>>;
  /** Fixed-time items (events): must be placed at exactly this local start, "YYYY-MM-DDTHH:MM". */
  fixedStart?: string;
  /** 0..100 busyness by hour of day 0..23 (e.g. from BestTime); lower is better. Optional. */
  busyByHour?: number[];
  /** Traveler's enthusiasm from swipes, 1..5; higher placed first/at best times. Default 3. */
  priority?: number;
};

export type ScheduleInput = {
  /** "YYYY-MM-DD", first full day. */
  startDate: string;
  /** Clamped to 1..14. */
  days: number;
  picks: SchedulePick[];
  /** Limits activity blocks (sight/activity/event) per day: easy 2, balanced 3, packed 5, plus meals. */
  pace: 'easy' | 'balanced' | 'packed';
  /** Default "09:00". */
  dayStart?: string;
  /** Default "23:30". */
  dayEnd?: string;
  /** Average travel speed in km/h between places (default 18, city mixed transit/walk). */
  travelKmh?: number;
  lodging?: { lat: number; lng: number };
};

export type ScheduledBlock = {
  pickId: string;
  name: string;
  kind: PickKind;
  /** "HH:MM" local; blocks after midnight wrap (e.g. "01:30"). */
  start: string;
  end: string;
  travelMinBefore: number;
  /** Short plain-English explanation of why this slot. */
  reason: string;
};

export type ScheduledDay = { date: string; blocks: ScheduledBlock[]; freeMinutes: number };

export type ScheduleResult = {
  days: ScheduledDay[];
  unscheduled: { pickId: string; reason: string }[];
  score: { placed: number; total: number; travelMin: number };
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAY = 1440;
/** Nothing (nightlife included) runs past 03:00 the next morning. */
const MAX_END = DAY + 3 * 60;
const GRID = 5;

const PICK_KINDS: readonly PickKind[] = ['breakfast', 'lunch', 'dinner', 'drinks', 'nightlife', 'sight', 'activity', 'event'];
/** One of each per day, placed before activities, in this order. */
const MEAL_KINDS: readonly PickKind[] = ['breakfast', 'lunch', 'dinner', 'drinks', 'nightlife'];

export const DEFAULT_DURATION_MIN: Record<PickKind, number> = {
  breakfast: 45,
  lunch: 75,
  dinner: 105,
  drinks: 75,
  nightlife: 150,
  sight: 90,
  activity: 150,
  event: 150,
};

export const PACE_LIMIT: Record<ScheduleInput['pace'], number> = { easy: 2, balanced: 3, packed: 5 };

/** Placement windows for meal-like kinds, [start, end] minutes; the block must fit fully inside. */
const MEAL_WINDOW: Partial<Record<PickKind, [number, number]>> = {
  breakfast: [7 * 60 + 30, 10 * 60 + 30],
  lunch: [11 * 60 + 30, 14 * 60 + 30],
  dinner: [18 * 60 + 30, 22 * 60],
  drinks: [17 * 60, 20 * 60],
  nightlife: [21 * 60 + 30, MAX_END],
};

/** Assumed opening hours when a pick has none. The reason text says so. */
const TYPICAL_HOURS: Record<PickKind, string> = {
  breakfast: '07:00-11:30',
  lunch: '11:00-15:30',
  dinner: '17:30-23:30',
  drinks: '16:00-02:00',
  nightlife: '21:00-04:00',
  sight: '09:00-18:00',
  activity: '08:00-21:00',
  event: '10:00-23:30',
};

const MEAL_SLOT: Partial<Record<PickKind, SlotKind>> = {
  breakfast: 'morning',
  lunch: 'lunch',
  dinner: 'dinner',
  drinks: 'apres',
  nightlife: 'late',
};

const MEAL_LABEL: Partial<Record<PickKind, string>> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
  drinks: 'drinks',
  nightlife: 'late-night',
};

const DEFAULT_KMH = 18;
const UNKNOWN_LEG_MIN = 20;
/** A day's cluster only grows with picks within this many travel minutes (unless it is the last day). */
const CLUSTER_RADIUS_MIN = 15;

// ---------------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------------

type Loc = { lat: number; lng: number };
type Interval = [number, number];

function parseClock(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (min > 59 || h > 24 || (h === 24 && min !== 0)) return null;
  return h * 60 + min;
}

/** "HH:MM-HH:MM"; an end at or before the start crosses midnight. */
function parseRange(value: unknown): Interval | null {
  if (typeof value !== 'string') return null;
  const parts = value.split(/\s*[-–]\s*/);
  if (parts.length !== 2) return null;
  const s = parseClock(parts[0]);
  let e = parseClock(parts[1]);
  if (s === null || e === null) return null;
  if (e <= s) e += DAY;
  return [s, e];
}

/** Classic slot times from the designer's SLOT_META ("9:00", "12:30", ...). */
function slotMinutes(slot: SlotKind): number {
  return parseClock(SLOT_META[slot].time) ?? 12 * 60;
}

function fmtClock(min: number): string {
  const m = ((min % DAY) + DAY) % DAY;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function fmtRange([a, b]: Interval): string {
  return `${fmtClock(a)}–${fmtClock(b)}`;
}

function parseIsoDate(value: unknown): { y: number; m: number; d: number } | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const probe = new Date(Date.UTC(y, m - 1, d, 12));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;
  return { y, m, d };
}

function addDays(date: { y: number; m: number; d: number }, n: number): string {
  return new Date(Date.UTC(date.y, date.m - 1, date.d + n, 12)).toISOString().slice(0, 10);
}

function weekdayOf(date: string): Weekday {
  return new Date(`${date}T12:00:00Z`).getUTCDay() as Weekday;
}

function haversineKm(a: Loc, b: Loc): number {
  const R = 6371;
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLng = (b.lng - a.lng) * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function validLoc(lat: unknown, lng: unknown): Loc | null {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/** Sort + merge overlapping or touching intervals. */
function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = [...list].sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const out: Interval[] = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

function clampInt(value: unknown, lo: number, hi: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(value)));
}

// ---------------------------------------------------------------------------
// Normalised picks
// ---------------------------------------------------------------------------

type Stop = {
  id: string;
  name: string;
  kind: PickKind;
  /** Input order, the final tie-breaker everywhere. */
  idx: number;
  loc: Loc | null;
  dur: number;
  priority: number;
  /** Per weekday opening ranges (possibly crossing midnight); null = unknown, typical hours assumed. */
  ranges: Interval[][] | null;
  busy: number[] | null;
  fixed: { date: string; min: number } | null;
};

const isActivity = (kind: PickKind) => kind === 'sight' || kind === 'activity' || kind === 'event';

/** Priority desc, then input order. */
const byRank = (a: Stop, b: Stop) => b.priority - a.priority || a.idx - b.idx;

function normaliseHours(hours: unknown): Interval[][] | null {
  if (!hours || typeof hours !== 'object') return null;
  const table: Interval[][] = [];
  let any = false;
  for (let wd = 0; wd < 7; wd++) {
    const raw = (hours as Record<number, unknown>)[wd];
    const list = Array.isArray(raw) ? raw.map(parseRange).filter((r): r is Interval => r !== null) : [];
    if (list.length) any = true;
    table.push(list);
  }
  return any ? table : null;
}

function normaliseBusy(busy: unknown): number[] | null {
  if (!Array.isArray(busy) || busy.length !== 24) return null;
  if (!busy.every((v) => typeof v === 'number' && Number.isFinite(v))) return null;
  return busy.map((v: number) => Math.min(100, Math.max(0, v)));
}

// ---------------------------------------------------------------------------
// Day state
// ---------------------------------------------------------------------------

type Basis = 'fixed' | 'busy' | 'meal-classic' | 'meal-slot' | 'open';

type Placed = { pick: Stop; start: number; end: number; basis: Basis };

type DayState = {
  date: string;
  weekday: Weekday;
  blocks: Placed[];
};

type Ctx = {
  dayStart: number;
  dayEnd: number;
  kmh: number;
  lodging: Loc | null;
  pace: number;
  days: DayState[];
};

/** Travel minutes between two stops, rounded up to 5 (min 10 beyond 0.3 km; unknown coords 20). */
export function travelMinutes(a: Loc | null, b: Loc | null, kmh: number = DEFAULT_KMH): number {
  if (!a || !b) return UNKNOWN_LEG_MIN;
  const km = haversineKm(a, b);
  if (km === 0) return 0;
  const speed = Number.isFinite(kmh) && kmh > 0 ? kmh : DEFAULT_KMH;
  let min = Math.ceil(((km / speed) * 60) / GRID) * GRID;
  if (km > 0.3) min = Math.max(min, 10);
  return min;
}

function legFromLodging(ctx: Ctx, p: Stop): number {
  return ctx.lodging ? travelMinutes(ctx.lodging, p.loc, ctx.kmh) : 0;
}

/** Opening windows for this pick on this weekday, on the day's minute axis (may go below 0 or past 24h). */
function openWindows(p: Stop, weekday: Weekday): Interval[] {
  if (!p.ranges) {
    const typical = parseRange(TYPICAL_HOURS[p.kind]) as Interval;
    const prevTail: Interval = [typical[0] - DAY, typical[1] - DAY];
    return mergeIntervals([prevTail, typical, [typical[0] + DAY, typical[1] + DAY]]);
  }
  const prev = p.ranges[(weekday + 6) % 7];
  const today = p.ranges[weekday];
  const next = p.ranges[(weekday + 1) % 7];
  return mergeIntervals([
    ...prev.filter(([, e]) => e > DAY).map(([s, e]): Interval => [s - DAY, e - DAY]),
    ...today,
    ...next.map(([s, e]): Interval => [s + DAY, e + DAY]),
  ]);
}

/** Where on the day's axis this kind may be placed, before opening hours. */
function placementWindow(ctx: Ctx, dayIdx: number, kind: PickKind): Interval {
  const meal = MEAL_WINDOW[kind];
  if (kind === 'nightlife') {
    let cap = Math.min(MAX_END, DAY + ctx.dayStart);
    const next = ctx.days[dayIdx + 1];
    for (const b of next?.blocks ?? []) cap = Math.min(cap, DAY + b.start);
    return [Math.max(meal![0], ctx.dayStart), cap];
  }
  if (meal) return [Math.max(meal[0], ctx.dayStart), Math.min(meal[1], ctx.dayEnd)];
  return [ctx.dayStart, ctx.dayEnd];
}

/** Opening ∩ placement windows that can hold the whole block. */
function allowedIntervals(ctx: Ctx, dayIdx: number, p: Stop): Interval[] {
  const [lo, hi] = placementWindow(ctx, dayIdx, p.kind);
  const out: Interval[] = [];
  for (const [a, b] of openWindows(p, ctx.days[dayIdx].weekday)) {
    const s = Math.max(a, lo);
    const e = Math.min(b, hi);
    if (e - s >= p.dur) out.push([s, e]);
  }
  return out;
}

function busySum(busy: number[], start: number, dur: number): number {
  let sum = 0;
  for (let t = start; t < start + dur; t += GRID) sum += busy[Math.floor(t / 60) % 24];
  return sum;
}

type Attempt = { ok: true; start: number; basis: Basis } | { ok: false; why: 'closed' | 'nofit' };

/** Best feasible start for `p` on a day given what is already placed. Does not mutate. */
function findSlot(ctx: Ctx, dayIdx: number, p: Stop): Attempt {
  const allowed = allowedIntervals(ctx, dayIdx, p);
  if (!allowed.length) return { ok: false, why: 'closed' };
  const blocks = ctx.days[dayIdx].blocks;
  const meal = MEAL_SLOT[p.kind];
  const preferred = meal ? slotMinutes(meal) : 0;

  let best: { start: number; key: number[] } | null = null;
  for (let i = 0; i <= blocks.length; i++) {
    const prev = blocks[i - 1];
    const next = blocks[i];
    const lo = prev
      ? prev.end + travelMinutes(prev.pick.loc, p.loc, ctx.kmh)
      : ctx.lodging
        ? ctx.dayStart + legFromLodging(ctx, p)
        : -Infinity;
    const hi = next ? next.start - travelMinutes(p.loc, next.pick.loc, ctx.kmh) - p.dur : Infinity;
    for (const [a, b] of allowed) {
      const from = Math.ceil(Math.max(lo, a) / GRID) * GRID;
      const to = Math.min(hi, b - p.dur);
      for (let s = from; s <= to; s += GRID) {
        const key = p.busy
          ? [busySum(p.busy, s, p.dur), s]
          : meal
            ? [Math.abs(s - preferred), s]
            : [s];
        if (!best || lexLess(key, best.key)) best = { start: s, key };
      }
    }
  }
  if (!best) return { ok: false, why: 'nofit' };
  const basis: Basis = p.busy ? 'busy' : meal ? (best.start === preferred ? 'meal-classic' : 'meal-slot') : 'open';
  return { ok: true, start: best.start, basis };
}

function lexLess(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

function insert(day: DayState, placed: Placed) {
  day.blocks.push(placed);
  day.blocks.sort((x, y) => x.start - y.start || x.pick.idx - y.pick.idx);
}

function hasRoom(ctx: Ctx, dayIdx: number, kind: PickKind): boolean {
  const blocks = ctx.days[dayIdx].blocks;
  if (isActivity(kind)) return blocks.filter((b) => isActivity(b.pick.kind)).length < ctx.pace;
  return !blocks.some((b) => b.pick.kind === kind);
}

/** Nearest-neighbour order from `start` (lodging) or the first located pick; unlocated go last in rank order. */
function nearestNeighbourOrder(picks: Stop[], start: Loc | null): Stop[] {
  const located = picks.filter((p) => p.loc).sort(byRank);
  const unlocated = picks.filter((p) => !p.loc).sort(byRank);
  const order: Stop[] = [];
  let here = start;
  while (located.length) {
    let bestI = 0;
    if (here) {
      let bestD = Infinity;
      located.forEach((p, i) => {
        const d = haversineKm(here!, p.loc!);
        if (d < bestD) {
          bestD = d;
          bestI = i;
        }
      });
    }
    const [next] = located.splice(bestI, 1);
    order.push(next);
    here = next.loc;
  }
  return [...order, ...unlocated];
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Build a deterministic, time-blocked plan. Throws a TypeError only when
 * `startDate` is not a real "YYYY-MM-DD" date; every other bad value is
 * clamped or reported per pick in `unscheduled`.
 */
export function buildSchedule(input: ScheduleInput): ScheduleResult {
  const start = parseIsoDate(input?.startDate);
  if (!start) throw new TypeError('startDate must be a valid "YYYY-MM-DD" date');

  const dayCount = clampInt(input.days, 1, 14, 1);
  const dayStart = parseClock(input.dayStart) ?? 9 * 60;
  let dayEnd = parseClock(input.dayEnd) ?? 23 * 60 + 30;
  if (dayEnd <= dayStart) dayEnd += DAY;
  dayEnd = Math.min(dayEnd, MAX_END);
  const kmh = typeof input.travelKmh === 'number' && Number.isFinite(input.travelKmh) && input.travelKmh > 0
    ? Math.min(200, Math.max(1, input.travelKmh))
    : DEFAULT_KMH;
  const pace = PACE_LIMIT[input.pace] ?? PACE_LIMIT.balanced;

  const days: DayState[] = [];
  for (let i = 0; i < dayCount; i++) {
    const date = addDays(start, i);
    days.push({ date, weekday: weekdayOf(date), blocks: [] });
  }
  const ctx: Ctx = { dayStart, dayEnd, kmh, lodging: validLoc(input.lodging?.lat, input.lodging?.lng), pace, days };
  const dayIndex = new Map(days.map((d, i) => [d.date, i]));

  // Record reasons keyed by id, then emit in input order.
  const failures = new Map<string, string>();
  const order: string[] = [];
  const picks: Stop[] = [];
  const seen = new Set<string>();

  const rawPicks: unknown[] = Array.isArray(input.picks) ? input.picks : [];
  rawPicks.forEach((raw, idx) => {
    const r = (raw ?? {}) as Partial<SchedulePick>;
    const id = typeof r.id === 'string' ? r.id.trim() : '';
    if (!id) {
      const key = `#${idx}`;
      order.push(key);
      failures.set(key, 'Pick has no id');
      return;
    }
    if (seen.has(id)) return; // duplicate id: keep the first
    seen.add(id);
    order.push(id);
    if (!PICK_KINDS.includes(r.kind as PickKind)) {
      failures.set(id, 'Unknown kind of place');
      return;
    }
    const kind = r.kind as PickKind;
    const dur = Math.ceil(clampInt(r.durationMin, 15, 720, DEFAULT_DURATION_MIN[kind]) / GRID) * GRID;
    let fixed: Stop['fixed'] = null;
    if (r.fixedStart !== undefined) {
      const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(String(r.fixedStart));
      const min = m ? parseClock(m[2]) : null;
      if (!m || !parseIsoDate(m[1]) || min === null || min >= DAY) {
        failures.set(id, 'Fixed start time is not a valid local date and time');
        return;
      }
      fixed = { date: m[1], min };
    }
    const window = MEAL_WINDOW[kind];
    if (!fixed && window && dur > window[1] - window[0]) {
      failures.set(id, `Longer than the ${MEAL_LABEL[kind]} window (${fmtRange(window)})`);
      return;
    }
    picks.push({
      id,
      name: typeof r.name === 'string' && r.name.trim() ? r.name.trim() : id,
      kind,
      idx,
      loc: validLoc(r.lat, r.lng),
      dur,
      priority: clampInt(r.priority, 1, 5, 3),
      ranges: normaliseHours(r.hours),
      busy: normaliseBusy(r.busyByHour),
      fixed,
    });
  });

  // 2. Fixed-time items, earliest first.
  const fixedPicks = picks
    .filter((p) => p.fixed)
    .sort((a, b) => a.fixed!.date.localeCompare(b.fixed!.date) || a.fixed!.min - b.fixed!.min || byRank(a, b));
  for (const p of fixedPicks) {
    const di = dayIndex.get(p.fixed!.date);
    if (di === undefined) {
      failures.set(p.id, 'Event date is outside the trip dates');
      continue;
    }
    const s = p.fixed!.min;
    const e = s + p.dur;
    const clash = days[di].blocks.find((b) => s < b.end && b.start < e)
      ?? (di > 0 ? days[di - 1].blocks.find((b) => b.end > DAY + s) : undefined);
    if (clash) {
      failures.set(p.id, `Clashes with fixed-time "${clash.pick.name}"`);
      continue;
    }
    insert(days[di], { pick: p, start: s, end: e, basis: 'fixed' });
  }

  // 3. Cluster flexible picks per day.
  const flex = picks.filter((p) => !p.fixed).sort(byRank);
  const assigned = new Set<string>();
  const plan: Stop[][] = days.map(() => []);
  let remainingActs = flex.filter((p) => isActivity(p.kind)).length;
  const clusterKm = (kmh * CLUSTER_RADIUS_MIN) / 60;

  days.forEach((day, di) => {
    const fixedActs = day.blocks.filter((b) => isActivity(b.pick.kind)).length;
    const actCap = Math.max(0, Math.min(pace - fixedActs, Math.ceil(remainingActs / (dayCount - di))));
    let actCount = 0;
    const mealsTaken = new Set(day.blocks.map((b) => b.pick.kind));
    const members: Loc[] = day.blocks.flatMap((b) => (b.pick.loc ? [b.pick.loc] : []));
    const canTake = (p: Stop) =>
      !assigned.has(p.id)
      && (isActivity(p.kind) ? actCount < actCap : !mealsTaken.has(p.kind))
      && allowedIntervals(ctx, di, p).length > 0;
    const take = (p: Stop) => {
      assigned.add(p.id);
      plan[di].push(p);
      if (isActivity(p.kind)) {
        actCount++;
        remainingActs--;
      } else mealsTaken.add(p.kind);
      if (p.loc) members.push(p.loc);
    };

    if (!members.length) {
      const seed = flex.find((p) => p.loc && canTake(p));
      if (seed) take(seed);
    }
    for (;;) {
      let best: Stop | null = null;
      let bestD = Infinity;
      for (const p of flex) {
        if (!p.loc || !canTake(p)) continue;
        let d = Infinity;
        for (const m of members) d = Math.min(d, haversineKm(m, p.loc));
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      if (!best) break;
      // Leave far-away picks to seed a later day while later days remain.
      if (members.length && di < dayCount - 1 && bestD > clusterKm) break;
      take(best);
    }
  });

  // Unlocated picks go to the open day with the most room left (earliest on ties).
  for (const p of flex) {
    if (p.loc || assigned.has(p.id)) continue;
    let bestDay = -1;
    let bestRoom = 0;
    days.forEach((day, di) => {
      if (!allowedIntervals(ctx, di, p).length) return;
      const planned = [...day.blocks.map((b) => b.pick), ...plan[di]];
      const room = isActivity(p.kind)
        ? pace - planned.filter((q) => isActivity(q.kind)).length
        : planned.some((q) => q.kind === p.kind) ? 0 : 1;
      if (room > bestRoom) {
        bestRoom = room;
        bestDay = di;
      }
    });
    if (bestDay >= 0) {
      assigned.add(p.id);
      plan[bestDay].push(p);
    }
  }

  // 4. Place per day: meals first (fixed windows), then activities in nearest-neighbour order.
  const leftovers: Stop[] = flex.filter((p) => !assigned.has(p.id));
  days.forEach((day, di) => {
    const meals = MEAL_KINDS.flatMap((k) => plan[di].filter((p) => p.kind === k));
    const acts = nearestNeighbourOrder(plan[di].filter((p) => isActivity(p.kind)), ctx.lodging);
    for (const p of [...meals, ...acts]) {
      const attempt = findSlot(ctx, di, p);
      if (attempt.ok) insert(day, { pick: p, start: attempt.start, end: attempt.start + p.dur, basis: attempt.basis });
      else leftovers.push(p);
    }
  });

  // 5. Retry leftovers on any day with room; otherwise explain why not.
  leftovers.sort(byRank);
  for (const p of leftovers) {
    let full = false;
    let noFit = false;
    let placed = false;
    for (let di = 0; di < dayCount && !placed; di++) {
      if (!hasRoom(ctx, di, p.kind)) {
        if (allowedIntervals(ctx, di, p).length) full = true;
        continue;
      }
      const attempt = findSlot(ctx, di, p);
      if (attempt.ok) {
        insert(days[di], { pick: p, start: attempt.start, end: attempt.start + p.dur, basis: attempt.basis });
        placed = true;
      } else if (attempt.why === 'nofit') noFit = true;
    }
    if (placed) continue;
    const label = MEAL_LABEL[p.kind];
    failures.set(
      p.id,
      noFit
        ? 'No free slot fits around the other plans and travel'
        : full
          ? isActivity(p.kind) ? 'Day full at this pace' : `Every day already has a ${label} stop`
          : 'No opening hours fit on these days',
    );
  }

  // Emit.
  let placedCount = 0;
  let travelTotal = 0;
  const outDays: ScheduledDay[] = days.map((day) => {
    const blocks: ScheduledBlock[] = [];
    const busyIntervals: Interval[] = [];
    day.blocks.forEach((b, i) => {
      const prev = day.blocks[i - 1];
      const travel = prev ? travelMinutes(prev.pick.loc, b.pick.loc, kmh) : legFromLodging(ctx, b.pick);
      travelTotal += travel;
      placedCount++;
      busyIntervals.push([b.start - travel, b.end]);
      blocks.push({
        pickId: b.pick.id,
        name: b.pick.name,
        kind: b.pick.kind,
        start: fmtClock(b.start),
        end: fmtClock(b.end),
        travelMinBefore: travel,
        reason: explain(b, prev, travel),
      });
    });
    let used = 0;
    for (const [a, b] of mergeIntervals(busyIntervals)) {
      used += Math.max(0, Math.min(b, dayEnd) - Math.max(a, dayStart));
    }
    return { date: day.date, blocks, freeMinutes: Math.max(0, dayEnd - dayStart - used) };
  });

  return {
    days: outDays,
    unscheduled: order.filter((id) => failures.has(id)).map((id) => ({
      pickId: id.startsWith('#') ? '' : id,
      reason: failures.get(id)!,
    })),
    score: { placed: placedCount, total: order.length, travelMin: travelTotal },
  };
}

function explain(b: Placed, prev: Placed | undefined, travel: number): string {
  const label = MEAL_LABEL[b.pick.kind];
  switch (b.basis) {
    case 'fixed':
      return 'Fixed event time';
    case 'busy':
      return 'Quietest time in its window per busy data';
    case 'meal-classic':
      return `Classic ${label} time`;
    case 'meal-slot':
      return `Best open ${label} slot`;
    default:
      if (prev && prev.pick.loc && b.pick.loc && travel <= 15) return `Near ${prev.pick.name} (${travel} min away)`;
      return b.pick.ranges ? 'Fits its opening hours' : 'Open slot; typical hours assumed';
  }
}

/** Map a scheduled block onto the designer's itinerary slot kinds. */
export function slotKindForBlock(block: Pick<ScheduledBlock, 'kind' | 'start'>): SlotKind {
  const meal = MEAL_SLOT[block.kind];
  if (meal) return meal;
  const min = parseClock(block.start) ?? 0;
  if (min < 5 * 60) return 'late';
  if (min < 12 * 60) return 'morning';
  if (min < 17 * 60) return 'afternoon';
  if (min < 21 * 60) return 'apres';
  return 'late';
}
