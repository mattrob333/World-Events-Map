import { planTripHref } from '@/lib/search/planPlace';
import { ACTIVITIES } from './data';
import { travelWindow } from './links';
import type { MonthSel } from './season';

/**
 * The designer link for a spot id from "Plan a trip here": the spot's place
 * and country, and its travel window for the chosen month (an event's own
 * dates). Null for an unknown id, so the caller falls back to its own page.
 */
export function spotTripHref(id: string, month: string | undefined, now: Date): string | null {
  const a = ACTIVITIES.find((x) => x.id === id);
  if (!a) return null;
  const m = Number(month);
  const sel: MonthSel = Number.isInteger(m) && m >= 1 && m <= 12 ? m : 'now';
  const { start, end } = travelWindow(a, sel, now);
  const nights = Math.max(1, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000));
  const kind = a.category === 'ski' ? 'ski' : a.category === 'surf' || a.category === 'beach' ? 'beach' : 'city';
  return planTripHref({ place: a.place, region: a.country, start, nights: Math.min(nights, 14), kind });
}
