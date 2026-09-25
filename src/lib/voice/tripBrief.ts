import { tripTypeFromText } from './tripType';
import type { TripType } from '@/lib/jev/contracts/feedItem';
import { wheresIn, type Where } from '@/lib/geo/regions';
import type { PlanPlace } from '@/lib/search/planPlace';
import { placeAfterPreposition, placeFromTripRequest, tripCrew, tripWhen, type TripCrew, type TripWhen } from './vibe';

export type TripBrief = {
  /** One destination to plan ("Verbier"), when they named one. */
  place: PlanPlace | null;
  /** Regions, countries or states they named ("the Alps", "Japan"). */
  wheres: Where[];
  when: TripWhen;
  crew: TripCrew | null;
  tripType: TripType | null;
};

const fold = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/^the\s+/, '').trim();

/**
 * Everything a spoken trip request says, read by code: where (a place, or a
 * region like the Alps that spans countries), when, who and what kind of trip.
 * Shared by the router and the stage's recap so both show the same reading.
 */
export function readTrip(text: string, today: string): TripBrief {
  const wheres = wheresIn(text);
  let place = placeFromTripRequest(text) ?? placeAfterPreposition(text);
  // "Switzerland" or "the Alps" is somewhere to choose within, not one destination.
  if (place && wheres.some((where) => fold(where.label) === fold(place!.place) || where.countries.some((country) => fold(country) === fold(place!.place)))) place = null;
  // "Ski trip to the Alps" or "a ski trip": a kind of trip, not a town.
  if (place && /\btrip\b/i.test(place.place)) place = null;
  const hinted = wheres.find((where) => where.hint)?.hint ?? null;
  return { place, wheres, when: tripWhen(text, today), crew: tripCrew(text), tripType: tripTypeFromText(text) ?? hinted };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Feb 1, 2027 · 7 nights" or "February 2027". */
export function whenLabel(when: TripWhen): string | null {
  if (!when.start) return when.nights ? `${when.nights} nights` : null;
  const [year, month, day] = when.start.split('-').map(Number) as [number, number, number];
  const date = `${MONTHS[month - 1]} ${day}, ${year}`;
  return when.nights ? `${date} · ${when.nights} nights` : `from ${date}`;
}
