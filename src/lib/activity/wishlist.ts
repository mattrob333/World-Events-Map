import type { IntentRecord } from '@/lib/intent/types';
import { CATEGORY_META, type Activity, type Category } from './activities';
import { parseDay, verdict } from './season';

/** One month cell in a wish-list row: peak, good, or not the time. */
export type MonthState = 'peak' | 'best' | 'off';

/** A dated stretch inside the 12-month window, in fractional months from the window's start. */
export interface Span {
  from: number;
  to: number;
}

export interface WishRow {
  key: string;
  name: string;
  place: string;
  href: string;
  color: string;
  category?: Category;
  /** 12 cells from the window's first month. Undated rows only. */
  months?: MonthState[];
  /** Event dates, when they fall in the window. */
  span?: Span;
  /** A short line: "Good now", "From Dec", "Oct 3 to Oct 5". */
  when: string;
  /** The full verdict, for the row's accessible label. */
  detail?: string;
  /** Months from now until it's next good (0 = now), for ordering. Unknown last. */
  soon: number;
}

/** Something on the calendar the traveler saved, as much as the wish list needs. */
export interface SavedEvent {
  id: string;
  name: string;
  city: string;
  start: string;
  end: string;
}

const DAY = 86_400_000;

/** Fractional months from the window start (1st of this month) to a day. */
function monthPos(day: Date, start: Date): number {
  const months = (day.getFullYear() - start.getFullYear()) * 12 + day.getMonth() - start.getMonth();
  const inMonth = new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate();
  return months + (day.getDate() - 1) / inMonth;
}

function spanFor(startIso: string, endIso: string, start: Date): Span | undefined {
  const s = parseDay(startIso), e = parseDay(endIso);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return undefined;
  const from = monthPos(s, start);
  const to = monthPos(new Date(e.getTime() + DAY), start);
  if (to <= 0 || from >= 12) return undefined;
  return { from: Math.max(0, from), to: Math.min(12, Math.max(to, from + 0.12)) };
}

/**
 * The traveler's wish list as rows on a 12-month calendar that starts this
 * month: every hearted spot (its good and peak months, or its event dates)
 * and every saved calendar event (its dates), soonest first. Built on the
 * device from the one list of saves; nothing here is sent anywhere.
 */
export function wishlistRows(
  saves: readonly IntentRecord[],
  activities: ReadonlyMap<string, Activity>,
  events: ReadonlyMap<string, SavedEvent>,
  now: Date,
): WishRow[] {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const rows: WishRow[] = [];
  for (const save of saves) {
    if (save.verb !== 'save') continue;
    if (save.kind === 'spot') {
      const a = activities.get(save.id);
      if (!a) continue;
      const base = {
        key: `spot:${a.id}`,
        name: a.name,
        place: a.country ? `${a.place}, ${a.country}` : a.place,
        href: `/?spot=${encodeURIComponent(a.id)}`,
        color: CATEGORY_META[a.category].color,
        category: a.category,
        when: verdict(a, 'now', now).text,
      };
      const span = a.kind === 'event' && a.eventDates ? spanFor(a.eventDates.start, a.eventDates.end, start) : undefined;
      if (span && a.eventDates) {
        rows.push({ ...base, when: formatShort(a.eventDates.start, a.eventDates.end), detail: base.when, span, soon: span.from });
      } else {
        // Undated spots, and events whose dates fall outside this year (past, or not
        // announced this far out), show the months they're usually best in.
        const months = Array.from({ length: 12 }, (_, i): MonthState => {
          const m = ((start.getMonth() + i) % 12) + 1;
          return a.peakMonths.includes(m) ? 'peak' : a.bestMonths.includes(m) ? 'best' : 'off';
        });
        const first = months.findIndex((state) => state !== 'off');
        const from = new Date(start.getFullYear(), start.getMonth() + Math.max(first, 0), 1).toLocaleDateString('en-US', { month: 'short' });
        // A short line fits under the name on a phone; the full verdict is the row's label.
        const when = first === 0 ? 'Good now' : first > 0 ? `From ${from}` : base.when;
        rows.push({ ...base, when, detail: base.when, months, soon: first < 0 ? 99 : first });
      }
    } else if (save.kind === 'event') {
      const ev = events.get(save.id);
      if (!ev) continue;
      const span = spanFor(ev.start, ev.end, start);
      if (!span) continue; // Past, or more than a year out.
      rows.push({
        key: `event:${ev.id}`,
        name: ev.name,
        place: ev.city,
        // Open it on the globe, wherever it was saved from.
        href: `/?event=${encodeURIComponent(ev.id)}`,
        color: '#F26B2A',
        span,
        when: formatShort(ev.start, ev.end),
        soon: span.from,
      });
    }
  }
  return rows.sort((x, y) => x.soon - y.soon || x.name.localeCompare(y.name));
}

function formatShort(startIso: string, endIso: string) {
  const f = (iso: string) => parseDay(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return startIso === endIso ? f(startIso) : `${f(startIso)} to ${f(endIso)}`;
}

/** Month initials for the window's columns, from this month. */
export function windowMonths(now: Date): { label: string; year?: number }[] {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    return {
      label: d.toLocaleDateString('en-US', { month: 'short' }),
      ...(d.getMonth() === 0 && i > 0 ? { year: d.getFullYear() } : {}),
    };
  });
}
