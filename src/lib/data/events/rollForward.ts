import type { WorldEvent } from '@/lib/types';

const DAY = 86_400_000;
const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** A season's own edition ("…-ss27", "…-aw27"): the next season is its own record, so it never rolls. */
const SEASON_EDITION = /-(?:ss|aw|fw|resort|pre-fall)\d{2}$/;

/**
 * Series whose host moves each edition (a different course, city or track):
 * cloning the last host's place would be wrong, so they never roll. Their
 * next edition is added when its host and dates are announced.
 */
export const HOST_ROTATES = new Set([
  'presidents-cup', 'ryder-cup', 'laver-cup', 'pga-championship', 'us-open-golf', 'the-open-championship',
  'breeders-cup-keeneland', 'worlds-50-best-restaurants-lima',
]);

/** A name that belongs to one edition ("…2026", "99th…", "Biennial 17") can't be reused for the next. */
const EDITION_NAME = /\b(?:19|20)\d{2}\b|\b\d+(?:st|nd|rd|th)\b|\s\d{1,3}$/;

/**
 * The same date `years` later, kept on the same weekday when the event starts
 * Thursday to Sunday (festivals, races and regattas hold their weekend), else
 * the same calendar day (a gala on the 22nd stays on the 22nd).
 */
export function sameWindow(start: string, years: number): string {
  const from = new Date(ms(start));
  const year = from.getUTCFullYear() + years;
  const monthDays = new Date(Date.UTC(year, from.getUTCMonth() + 1, 0)).getUTCDate();
  // 29 February becomes the 28th in a common year.
  const next = Date.UTC(year, from.getUTCMonth(), Math.min(from.getUTCDate(), monthDays));
  const weekday = from.getUTCDay();
  if (![4, 5, 6, 0].includes(weekday)) return iso(next);
  // Nearest day with the same weekday, at most 3 days either way.
  let shift = (weekday - new Date(next).getUTCDay() + 7) % 7;
  if (shift > 3) shift -= 7;
  return iso(next + shift * DAY);
}

/**
 * A recurring event that has ended comes back as its next edition, in its
 * usual window and marked projected, until someone records the announced
 * dates (by updating the event itself). One-off events, a season's own
 * edition, series whose host rotates and edition-named events stay as they
 * are; the lists hide them once they've ended. The id is
 * kept, so links, saves and Wikipedia mapping follow the series.
 */
export function rollForward(event: WorldEvent, today: string): WorldEvent {
  if (event.end >= today || event.recurrence === 'one-off' || SEASON_EDITION.test(event.id) || HOST_ROTATES.has(event.id) || EDITION_NAME.test(event.name)) return event;
  const step = event.recurrence === 'biennial' ? 2 : 1;
  const length = Math.round((ms(event.end) - ms(event.start)) / DAY);
  let years = step;
  let start = sameWindow(event.start, years);
  while (iso(ms(start) + length * DAY) < today) {
    years += step;
    start = sameWindow(event.start, years);
  }
  return { ...event, start, end: iso(ms(start) + length * DAY), datesStatus: 'projected' };
}
