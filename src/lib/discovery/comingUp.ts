import { addDays, daysBetween } from '@/lib/buzz/dates';
import { scoreEvent } from '@/lib/buzz/scoring';
import type { WorldEvent } from '@/lib/types';
import { whyNow, type WhyNow } from './whyNow';

export const COMING_UP_DAYS = 56;
const MAX_LANES = 20;
const PLAN_LANES = 3;
const NOW_LANES = 3;
/** Runs longer than this are seasons (a dry season, a migration), not moments; they rank last. */
const SEASON_DAYS = 21;

export type Lane = {
  event: WorldEvent;
  why: WhyNow;
  /** Column range of the event inside the window, when it overlaps it */
  bar?: { from: number; to: number };
  /** Column of the plan-by date, when it falls inside the window */
  planCol?: number;
  sortKey: number;
  /** Buzz score at `today`, the tie-breaker inside a band */
  buzz: number;
};

/**
 * The rows of the coming-up calendar for `today`: moments on now, then
 * starting soon, then plan-by heads-ups, with long seasons last; drawn in
 * date order.
 */
export function buildLanes(events: readonly WorldEvent[], today: string): Lane[] {
  const last = addDays(today, COMING_UP_DAYS - 1);
  const lanes: Lane[] = [];
  for (const event of events) {
    if (event.end < today) continue;
    const why = whyNow(event, today);
    const overlaps = event.start <= last;
    const deadline = why.planBy?.deadline;
    const planCol = deadline && deadline >= today && deadline <= last && deadline < event.start ? daysBetween(today, deadline) : undefined;
    if (!overlaps && planCol === undefined) continue;
    const bar = overlaps
      ? { from: Math.max(0, daysBetween(today, event.start)), to: Math.min(COMING_UP_DAYS - 1, daysBetween(today, event.end)) }
      : undefined;
    // Moments first: on now, then starting soon, then plan-by heads-ups; long seasons last.
    const season = daysBetween(event.start, event.end) > SEASON_DAYS;
    const band = season ? 3 : why.tone === 'now' ? 0 : bar ? 1 : 2;
    lanes.push({ event, why, bar, planCol, sortKey: band * 1000 + Math.min(bar?.from ?? COMING_UP_DAYS, planCol ?? COMING_UP_DAYS), buzz: scoreEvent(event, { now: today }).score });
  }
  const urgent = (lane: Lane) => (lane.why.planBy?.urgency === 'critical' ? 0 : lane.why.planBy?.urgency === 'closing' ? 1 : 2);
  const ranked = lanes.sort((a, b) => a.sortKey - b.sortKey || b.buzz - a.buzz || urgent(a) - urgent(b) || a.event.id.localeCompare(b.event.id));
  // Keep room for plan-by heads-ups: the point is to warn early, not only to list what's on.
  const heads = ranked.filter((lane) => lane.planCol !== undefined && !lane.bar).slice(0, PLAN_LANES);
  const rest = ranked.filter((lane) => !heads.includes(lane));
  const room = MAX_LANES - heads.length;
  // Mix what's on with what starts soon, so tomorrow's opener isn't crowded out by a busy today.
  const onNow = rest.filter((lane) => lane.why.tone === 'now').slice(0, NOW_LANES);
  const soonFirst = rest.filter((lane) => lane.why.tone !== 'now');
  const moreNow = rest.filter((lane) => lane.why.tone === 'now' && !onNow.includes(lane));
  // Every week of the window gets its best moment, so scrolling right never runs into empty weeks.
  const weekly: Lane[] = [];
  for (let week = 1; week * 7 < COMING_UP_DAYS; week += 1) {
    const best = soonFirst.filter((lane) => lane.bar && lane.sortKey < 3000 && Math.floor(lane.bar.from / 7) === week).sort((a, b) => b.buzz - a.buzz)[0];
    if (best) weekly.push(best);
  }
  const moments = [...new Set([...onNow, ...weekly, ...soonFirst, ...moreNow])].slice(0, room);
  const picked = [...moments, ...heads];
  // Draw in date order so the calendar reads left to right, top to bottom.
  return picked.sort((a, b) => (a.bar?.from ?? a.planCol ?? COMING_UP_DAYS) - (b.bar?.from ?? b.planCol ?? COMING_UP_DAYS) || a.sortKey - b.sortKey);
}

/** What a lane says on the calendar: the event first, then where. */
export function laneLabel(lane: Lane): string {
  const { event, bar } = lane;
  if (bar) return `${shortName(event.name)} · ${event.city}`;
  return `${planWord(lane)} → ${shortName(event.name)}`;
}

/** "Paris Fashion Week — Spring/Summer 2027" reads as "Paris Fashion Week" on the strip; the full name is in its tooltip. */
export function shortName(name: string): string {
  return name.split(/\s[—–-]\s/)[0]!.trim();
}

/** The plan-by words for the strip: short, the diamond's color carries the urgency. */
export function planWord(lane: Lane): string {
  const deadline = lane.why.planBy?.deadline;
  if (!deadline) return 'Plan ahead';
  return lane.planCol === 0 ? 'Book today' : `Book by ${shortDateOf(deadline)}`;
}

const shortDateOf = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

const LABEL_MAX = 34;
/** Roughly how many day columns a label needs at the calendar's type size. */
export function labelColumns(label: string, columnPx: number): number {
  const chars = Math.min(label.length, LABEL_MAX + 1);
  return Math.max(2, Math.ceil((chars * 7.1 + 34) / columnPx));
}

export type PlacedLane = Lane & { label: string; start: number; end: number };

/**
 * Packs lanes onto as few rows as possible: anything whose span (its dates,
 * and room for its label) doesn't overlap shares a row. Keeps every event and
 * makes the calendar a few rows tall instead of one row per event.
 */
export function packRows(lanes: readonly Lane[], columnPx: number, days = COMING_UP_DAYS): PlacedLane[][] {
  const placed = lanes.map((lane): PlacedLane => {
    const label = laneLabel(lane);
    const from = Math.min(lane.bar?.from ?? days, lane.planCol ?? days);
    const dated = lane.bar ? lane.bar.to + 1 : from + 1;
    const labelStart = lane.bar ? lane.bar.from : (lane.planCol ?? 0);
    return { ...lane, label, start: from, end: Math.min(days + 12, Math.max(dated, labelStart + labelColumns(label, columnPx))) };
  });
  placed.sort((a, b) => a.start - b.start || b.end - a.end);
  const rows: PlacedLane[][] = [];
  const ends: number[] = [];
  for (const lane of placed) {
    // A little air between neighbors on the same row.
    const row = ends.findIndex((end) => end + 0.25 <= lane.start);
    if (row === -1) {
      rows.push([lane]);
      ends.push(lane.end);
    } else {
      rows[row]!.push(lane);
      ends[row] = lane.end;
    }
  }
  return rows;
}
