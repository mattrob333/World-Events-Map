/**
 * Tonight's closing time from Google Places opening hours. Pure: the paid
 * lookup is in googlePlaces.ts.
 *
 * Google gives weekly periods ({ day 0=Sunday, hour, minute } open and close,
 * in the place's local time) plus the place's UTC offset, so "now" is worked
 * out where the place is, not where the server is.
 */
import { nightClock } from './tonight';

export type HoursPoint = { day: number; hour: number; minute: number };
export type HoursPeriod = { open: HoursPoint; close?: HoursPoint };

const WEEK = 7 * 1440;
const at = (point: HoursPoint) => point.day * 1440 + point.hour * 60 + point.minute;

/** The place's local weekday (0 = Sunday) and minutes since its midnight. */
export function localNow(nowUtc: Date, utcOffsetMinutes: number): { day: number; minutes: number } {
  const local = new Date(nowUtc.getTime() + utcOffsetMinutes * 60_000);
  return { day: local.getUTCDay(), minutes: local.getUTCHours() * 60 + local.getUTCMinutes() };
}

/**
 * When the place closes, on the night clock the Tonight timeline and picks
 * use (tonight.ts): minutes after the midnight that began this evening, so a
 * 2am close is 1560 at 10pm and still 1560 at 1am (before 5am, now belongs to
 * last night). Only if it is open now. `'open-24h'` for a period with no
 * close; null when closed now or the hours don't say.
 */
export function closesTonight(periods: readonly HoursPeriod[], now: { day: number; minutes: number }): number | 'open-24h' | null {
  const nowAt = now.day * 1440 + now.minutes;
  for (const period of periods) {
    if (!period.close) return 'open-24h';
    const open = at(period.open);
    let close = at(period.close);
    if (close <= open) close += WEEK; // runs past the end of the week (Saturday into Sunday)
    for (const shift of [0, WEEK, -WEEK]) {
      const start = open + shift;
      const end = close + shift;
      if (nowAt >= start && nowAt < end) return end - now.day * 1440 + (nightClock(now.minutes) - now.minutes);
    }
  }
  return null;
}
