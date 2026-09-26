import type { PulseVenue } from './pulse';

/**
 * Vibe Now's "Tonight" timeline: from now until the last place closes, on an
 * hourly scale. Times are minutes on the closing-time clock (after today's
 * midnight; 2am tomorrow = 1560). Pure.
 */
export type TonightRow = {
  venue: PulseVenue;
  /** Where the bar starts and ends, 0–1 across the window; null end when hours are unknown. */
  from: number;
  to: number | null;
  /** Minutes left until it closes, when known. */
  minutesLeft: number | null;
};

export type Tonight = { start: number; end: number; ticks: { at: number; label: string; position: number }[]; rows: TonightRow[] };

const MIN_SPAN = 3 * 60;
const MAX_SPAN = 8 * 60;

/** Before 5am, now belongs to last night: 1am is 1500 on the closing-time clock. */
export const nightClock = (nowMinutes: number) => (nowMinutes < 300 ? nowMinutes + 1440 : nowMinutes);

export function hourLabel(minutes: number): string {
  const h = Math.floor((((minutes % 1440) + 1440) % 1440) / 60);
  if (h === 0) return '12am';
  if (h === 12) return '12pm';
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

export function buildTonight(venues: readonly PulseVenue[], nowMinutes: number): Tonight {
  const now = nightClock(nowMinutes);
  const closes = venues.map((venue) => (venue.openAllNight ? now + MAX_SPAN : venue.closesMinutes)).filter((value): value is number => value !== undefined && value > now);
  const last = closes.length ? Math.max(...closes) : now + MIN_SPAN;
  const start = Math.floor(now / 60) * 60;
  const end = Math.min(start + MAX_SPAN, Math.max(start + MIN_SPAN, Math.ceil(last / 60) * 60));
  const span = end - start;
  const at = (minutes: number) => Math.max(0, Math.min(1, (minutes - start) / span));
  const ticks = [];
  for (let t = start; t <= end; t += 60) ticks.push({ at: t, label: hourLabel(t), position: at(t) });
  const rows = venues.map((venue) => {
    const close = venue.openAllNight ? end : venue.closesMinutes;
    const known = close !== undefined;
    return {
      venue,
      from: at(now),
      to: known ? at(close!) : null,
      minutesLeft: known ? (venue.openAllNight ? null : Math.max(0, close! - now)) : null,
    };
  }).filter((row) => row.minutesLeft === null || row.minutesLeft > 0);
  return { start, end, ticks, rows };
}
