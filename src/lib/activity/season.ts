import { MONTHS_SHORT, type Activity } from './activities';

/** "now" or a calendar month 1-12. */
export type MonthSel = "now" | number;
export type Tone = "good" | "season" | "off";

export const TONE_COLOR: Record<Tone, string> = {
  good: "#F7C548", // saffron
  season: "#C8A866", // brass
  off: "#A8A598", // muted. Never red.
};

const DAY = 86_400_000;

export function currentMonth(now: Date) {
  return now.getMonth() + 1;
}

/** Date the selection refers to: today for "now" or this month, else the 1st of the next occurrence. */
export function referenceDate(sel: MonthSel, now: Date): Date {
  const cur = currentMonth(now);
  if (sel === "now" || sel === cur) return startOfDay(now);
  const year = sel > cur ? now.getFullYear() : now.getFullYear() + 1;
  return new Date(year, sel - 1, 1);
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function parseDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Is the spot "in season" for the selection? Events use their dated window when known. */
export function isInSeason(a: Activity, sel: MonthSel, now: Date): boolean {
  const month = sel === "now" ? currentMonth(now) : sel;
  if (a.kind === "event" && a.eventDates) {
    const s = parseDay(a.eventDates.start), e = parseDay(a.eventDates.end);
    if (sel === "now") {
      const t = startOfDay(now).getTime();
      // Treat the event as "in season" from 6 weeks before it starts until it ends.
      return t <= e.getTime() && t >= s.getTime() - 42 * DAY;
    }
    // Any overlap between the event window and the selected month.
    for (let d = new Date(s); d <= e; d = new Date(d.getTime() + DAY)) {
      if (d.getMonth() + 1 === month) return true;
    }
    return false;
  }
  return a.bestMonths.includes(month);
}

/** "Dec to Mar", "Mar to May and Sep to Nov", "all year". */
export function formatMonthRanges(months: number[]): string {
  if (months.length >= 12) return "all year";
  if (!months.length) return "";
  const set = new Set(months);
  // Find range starts: months in the set whose previous month is not in the set.
  const starts = [...set].filter((m) => !set.has(((m + 10) % 12) + 1)).sort((a, b) => a - b);
  const parts = starts.map((s) => {
    let e = s;
    while (set.has((e % 12) + 1) && (e % 12) + 1 !== s) e = (e % 12) + 1;
    return s === e ? MONTHS_SHORT[s - 1] : `${MONTHS_SHORT[s - 1]} to ${MONTHS_SHORT[e - 1]}`;
  });
  return parts.length > 1 ? parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1] : parts[0];
}

export function bestLine(a: Activity) {
  const r = formatMonthRanges(a.bestMonths);
  return r === "all year" ? "Good all year" : `Best ${r}`;
}

/** Whole weeks from `from` to the first day of the next best month. */
export function weeksUntilSeason(a: Activity, from: Date): number | null {
  if (!a.bestMonths.length) return null;
  for (let i = 0; i <= 12; i++) {
    const d = new Date(from.getFullYear(), from.getMonth() + i, 1);
    if (d < from) continue;
    if (a.bestMonths.includes(d.getMonth() + 1)) return Math.floor((d.getTime() - from.getTime()) / (7 * DAY));
  }
  return null;
}

function waitText(weeks: number, days: number) {
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 7) return `in ${days} days`;
  if (weeks === 1) return "in about a week";
  if (weeks <= 12) return `in about ${weeks} weeks`;
  return `in about ${Math.round(days / 30.4)} months`;
}

function fmtDay(d: Date) {
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

export function formatEventRange(start: string, end: string) {
  const s = parseDay(start), e = parseDay(end);
  if (start === end) return fmtDay(s);
  if (s.getMonth() === e.getMonth()) return `${fmtDay(s)} to ${e.getDate()}`;
  return `${fmtDay(s)} to ${fmtDay(e)}`;
}

export interface LiveGood {
  /** Short reason when current conditions are good, e.g. "14 in of new snow this week". */
  good: string | null;
}

export interface Verdict {
  tone: Tone;
  text: string;
}

/**
 * The card's verdict line. Rules from the brief:
 *  - in season + good live conditions: "Good now: 14 in of new snow this week"
 *  - in season: "In season now. Best Dec to Mar"
 *  - out of season: "Opens in about 8 weeks. Best Dec to Mar"
 *  - event: "Oct 31 to Nov 2. 5 weeks away"
 */
export function verdict(a: Activity, sel: MonthSel, now: Date, live?: LiveGood | null): Verdict {
  const ref = referenceDate(sel, now);
  const isNow = sel === "now" || sel === currentMonth(now);

  if (a.kind === "event") {
    const ev = a.eventDates;
    if (!ev) return { tone: "off", text: a.datesNote ?? `Dates not announced yet. Usually ${formatMonthRanges(a.bestMonths)}` };
    const s = parseDay(ev.start), e = parseDay(ev.end);
    const range = formatEventRange(ev.start, ev.end) + (ev.status === "estimated" ? " (estimated)" : "");
    // The organizer has this date in doubt: say so rather than count down to it.
    if (ev.status === "under-review") return { tone: "off", text: `Date under review. Listed for ${formatEventRange(ev.start, ev.end)}` };
    const today = startOfDay(now);
    if (today >= s && today <= e) return { tone: "good", text: `On now. Ends ${fmtDay(e)}` };
    if (today > e) return { tone: "off", text: `${range}. This edition has ended` };
    const days = Math.round((s.getTime() - today.getTime()) / DAY);
    const weeks = Math.round(days / 7); // countdowns round to the nearest week
    const away =
      days === 0 ? "Starts today" : days === 1 ? "Starts tomorrow" : days < 7 ? `${days} days away`
      : weeks === 1 ? "1 week away" : weeks <= 12 ? `${weeks} weeks away` : `${Math.round(days / 30.4)} months away`;
    return { tone: isInSeason(a, sel, now) ? "season" : "off", text: `${range}. ${away}` };
  }

  const month = sel === "now" ? currentMonth(now) : sel;
  if (a.bestMonths.includes(month)) {
    if (isNow && live?.good) return { tone: "good", text: `Good now: ${live.good}` };
    const when = isNow ? "In season now" : `In season in ${MONTHS_SHORT[month - 1]}`;
    return { tone: "season", text: `${when}. ${bestLine(a)}` };
  }
  const weeks = weeksUntilSeason(a, ref);
  if (weeks === null) return { tone: "off", text: bestLine(a) };
  const days = Math.round(
    (new Date(ref.getFullYear(), ref.getMonth() + monthsAhead(a, ref), 1).getTime() - ref.getTime()) / DAY,
  );
  const w = waitText(weeks, days);
  return { tone: "off", text: `Opens ${w}. ${bestLine(a)}` };
}

function monthsAhead(a: Activity, ref: Date) {
  for (let i = 0; i <= 12; i++) {
    const d = new Date(ref.getFullYear(), ref.getMonth() + i, 1);
    if (d < ref) continue;
    if (a.bestMonths.includes(d.getMonth() + 1)) return i;
  }
  return 0;
}
