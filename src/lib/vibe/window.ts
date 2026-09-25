import { addDays, daysBetween } from '@/lib/buzz/dates';
import type { TripWhen } from '@/lib/voice/vibe';

export type TripWindow = { from: string; to: string; days: number; exact: boolean };

/**
 * The dates a request is about: start plus nights when both were said
 * ("first week of February" is Feb 1–8), the named month when only a month
 * was, otherwise the next 60 days.
 */
export function tripWindow(when: TripWhen, today: string, horizonDays = 60): TripWindow {
  const clamp = (iso: string) => (iso < today ? today : iso);
  if (when.start && when.nights) {
    const from = clamp(when.start);
    const to = addDays(when.start, when.nights);
    return { from, to, days: daysBetween(from, to) + 1, exact: true };
  }
  if (when.month) {
    const from = clamp(when.start && when.start > when.month.from ? when.start : when.month.from);
    const last = new Date(`${when.month.from.slice(0, 7)}-01T12:00:00Z`);
    last.setUTCMonth(last.getUTCMonth() + 1, 0);
    const to = last.toISOString().slice(0, 10);
    return { from, to, days: daysBetween(from, to) + 1, exact: false };
  }
  if (when.start) {
    const from = clamp(when.start);
    return { from, to: addDays(from, 7), days: 8, exact: false };
  }
  return { from: today, to: addDays(today, horizonDays), days: horizonDays + 1, exact: false };
}
