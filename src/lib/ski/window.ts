/**
 * The traveler's window: the stretch of dates they could go, and how many
 * nights. The planner turns it into the months it covers (to judge snow) and
 * the possible weeks inside it (to pick the best one). Pure, all in UTC days.
 */

export interface TripWindow {
  /** ISO dates, inclusive. */
  from: string;
  to: string;
  nights: number;
}

export interface Week {
  /** ISO dates: arrive on `start`, leave on `end`. */
  start: string;
  end: string;
}

const DAY = 86_400_000;
const parse = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
export const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (iso: string, days: number) => isoDay(parse(iso) + days * DAY);

/** Is this a real calendar date, written YYYY-MM-DD? */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const ms = parse(value);
  return Number.isFinite(ms) && isoDay(ms) === value;
}

/** Days in the window per calendar month (1 to 12). A window crossing New Year counts both Decembers and Januaries. */
export function monthWeights(from: string, to: string): Map<number, number> {
  const out = new Map<number, number>();
  const end = parse(to);
  for (let day = parse(from); day <= end; day += DAY) {
    const month = new Date(day).getUTCMonth() + 1;
    out.set(month, (out.get(month) ?? 0) + 1);
  }
  return out;
}

/**
 * The weeks someone could actually go: every Saturday arrival whose stay fits
 * inside the window. A window too short for a Saturday start gives the window itself.
 */
export function candidateWeeks(window: TripWindow): Week[] {
  const nights = Math.max(1, Math.min(21, Math.round(window.nights)));
  const first = parse(window.from);
  const last = parse(window.to);
  const weeks: Week[] = [];
  const saturday = first + ((6 - new Date(first).getUTCDay() + 7) % 7) * DAY;
  for (let start = saturday; start + nights * DAY <= last; start += 7 * DAY) {
    weeks.push({ start: isoDay(start), end: isoDay(start + nights * DAY) });
  }
  if (!weeks.length) weeks.push({ start: window.from, end: isoDay(Math.min(last, first + nights * DAY)) });
  return weeks;
}

/** Do two inclusive date spans share a day? */
export const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) => aStart <= bEnd && bStart <= aEnd;

/** The nth weekday (0 Sunday) of a month, as an ISO date. */
function nthWeekday(year: number, month: number, weekday: number, n: number): string {
  const first = Date.UTC(year, month - 1, 1);
  const offset = (weekday - new Date(first).getUTCDay() + 7) % 7;
  return isoDay(first + (offset + (n - 1) * 7) * DAY);
}

export interface CrowdWeek {
  start: string;
  end: string;
  label: string;
}

/**
 * The weeks resorts are at their busiest and dearest, worked out from the
 * calendar: the holidays everywhere, plus the US long weekends at US resorts.
 */
export function crowdWeeks(year: number, countryCode: string): CrowdWeek[] {
  const weeks: CrowdWeek[] = [
    { start: `${year - 1}-12-24`, end: `${year}-01-02`, label: 'Christmas and New Year' },
    { start: `${year}-12-24`, end: `${year + 1}-01-02`, label: 'Christmas and New Year' },
  ];
  if (countryCode === 'US') {
    const mlk = nthWeekday(year, 1, 1, 3);
    const presidents = nthWeekday(year, 2, 1, 3);
    weeks.push({ start: addDays(mlk, -2), end: mlk, label: 'MLK weekend' });
    // Many schools take the whole week off.
    weeks.push({ start: addDays(presidents, -2), end: addDays(presidents, 6), label: 'Presidents’ Day week' });
  }
  return weeks;
}

/** "Nov 21". */
export function formatDay(iso: string): string {
  const date = new Date(parse(iso));
  return `${date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })} ${date.getUTCDate()}`;
}

export function formatSpan(start: string, end: string): string {
  const fmt = (iso: string, withMonth: boolean) => {
    const date = new Date(parse(iso));
    const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    return withMonth ? `${month} ${date.getUTCDate()}` : `${date.getUTCDate()}`;
  };
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  return `${fmt(start, true)} to ${fmt(end, !sameMonth)}`;
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Year-round", "Dec to Apr" (a run that may wrap the new year), or a short list. */
export function monthsLabel(months: readonly number[]): string {
  const set = new Set(months);
  if (set.size >= 12) return 'Year-round';
  if (!set.size) return '';
  // Find a start month whose previous month is missing; a single unbroken run reads as a span.
  const starts = [...set].filter((month) => !set.has(month === 1 ? 12 : month - 1));
  if (starts.length === 1) {
    let end = starts[0];
    while (set.has(end === 12 ? 1 : end + 1)) end = end === 12 ? 1 : end + 1;
    return end === starts[0] ? MONTH_SHORT[end - 1] : `${MONTH_SHORT[starts[0] - 1]} to ${MONTH_SHORT[end - 1]}`;
  }
  return [...set].sort((a, b) => a - b).map((month) => MONTH_SHORT[month - 1]).join(', ');
}
