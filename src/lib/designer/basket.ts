import type { DestinationResearch, ResearchSpot } from '@/lib/research/destinationSources';
import type { FitCandidate } from '@/lib/jev/contracts/tripFit';
import type { TravelerProfile } from './profile';
import type { PickKind, SchedulePick } from './schedule';

export type BasketSection = 'topSpots' | 'hiddenGems' | 'food' | 'nightlife' | 'tripadvisor' | 'yelp';
export const BASKET_SECTIONS: BasketSection[] = ['topSpots', 'hiddenGems', 'food', 'nightlife', 'tripadvisor', 'yelp'];
export const BASKET_MAX = 48;

/** A real listing in the basket, with where it came from. */
export type BasketItem = ResearchSpot & { section: BasketSection; kind: PickKind };

const BREAKFAST = /\b(breakfast|brunch|bakery|caf[eé]|coffee|pastel|patisserie)\b/i;
const NIGHT = /\b(club|nightclub|disco|techno|dance|late[- ]night)\b/i;
const ACTIVITY = /\b(tour|park|hike|trail|beach|surf|ski|boat|cruise|kayak|climb|spa|market|garden|zoo|aquarium)\b/i;

/** What kind of stop a listing is, from the tab it came from and its own category words. */
export function pickKindFor(section: BasketSection, spot: Pick<ResearchSpot, 'name' | 'category'>): PickKind {
  const words = `${spot.name} ${spot.category ?? ''}`;
  if (section === 'food' || section === 'yelp') return BREAKFAST.test(words) ? 'breakfast' : 'dinner';
  if (section === 'nightlife') return NIGHT.test(words) ? 'nightlife' : 'drinks';
  return ACTIVITY.test(words) ? 'activity' : 'sight';
}

const nameKey = (name: string) => name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Every listing the device already fetched, deduped by name, capped. No new provider calls. */
export function basketItems(research: Pick<DestinationResearch, BasketSection>): BasketItem[] {
  const seen = new Set<string>();
  const items: BasketItem[] = [];
  for (const section of BASKET_SECTIONS) {
    const block = research[section];
    if (block?.status !== 'ok') continue;
    for (const spot of block.items) {
      const key = nameKey(spot.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      items.push({ ...spot, section, kind: pickKindFor(section, spot) });
    }
  }
  return items.slice(0, BASKET_MAX);
}

export function fitCandidates(items: BasketItem[]): FitCandidate[] {
  return items.map((item) => ({
    id: item.id, name: item.name, kind: item.kind, category: item.category, rating: item.rating,
    reviews: item.reviews, price: item.price, snippet: item.snippet, source: item.source,
  }));
}

/**
 * Likes sent to the fit check and matched on cards: food and interests only.
 * Music, artists and teams stay on the device; no listing here needs them.
 */
export function profileLikes(profile: TravelerProfile | undefined): string[] {
  if (!profile) return [];
  return [...new Set([...profile.food, ...profile.interests].map((like) => like.trim()).filter((like) => like.length >= 3))].slice(0, 24);
}

/** Kept cards become scheduler picks; swipe order stands in for enthusiasm. */
export function schedulePicks(kept: BasketItem[]): SchedulePick[] {
  return kept.map((item, index) => ({
    id: item.id,
    name: item.name,
    kind: item.kind,
    lat: item.lat,
    lng: item.lng,
    priority: Math.max(1, 5 - Math.floor(index / 3)),
  }));
}

function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Which days the scheduler fills. The itinerary's first day is the journey in
 * and its last is the journey home, so picks go into the full days between.
 * A one-night trip gets the arrival afternoon.
 */
export function planWindow(startDate: string, nights: number): { startDate: string; days: number; dayStart?: string; note: string } {
  if (nights >= 2) {
    return { startDate: addDaysIso(startDate, 1), days: Math.min(14, nights - 1), note: 'Arrival and departure days are left for getting there and back.' };
  }
  return { startDate, days: 1, dayStart: '15:00', note: 'One night, so plans start mid-afternoon on arrival day.' };
}

/** A stand-in for where they stay: the middle of the places found (median, so one far day trip doesn't drag it). */
export function lodgingGuess(items: Pick<BasketItem, 'lat' | 'lng'>[]): { lat: number; lng: number } | undefined {
  const located = items.filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
  if (located.length < 2) return undefined;
  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  };
  return { lat: median(located.map((item) => item.lat as number)), lng: median(located.map((item) => item.lng as number)) };
}

type CrewMember = { name: string; kind: 'adult' | 'kid'; age?: number };

/** "2 adults, kids 8 and 12": who's coming, without anyone's name. */
export function crewLine(crew: CrewMember[]): string {
  const adults = crew.filter((person) => person.kind === 'adult').length;
  const ages = crew.filter((person) => person.kind === 'kid').map((person) => person.age).filter((age): age is number => age !== undefined).sort((a, b) => a - b);
  const kids = crew.length - adults;
  const parts = [adults ? `${adults} adult${adults === 1 ? '' : 's'}` : ''];
  if (kids) parts.push(ages.length === kids ? `${kids === 1 ? 'a kid' : 'kids'} aged ${ages.length > 1 ? `${ages.slice(0, -1).join(', ')} and ${ages.at(-1)}` : ages[0]}` : `${kids} kid${kids === 1 ? '' : 's'}`);
  return parts.filter(Boolean).join(', ');
}

export function kidAges(crew: CrewMember[]): number[] {
  return crew.filter((person) => person.kind === 'kid').map((person) => person.age ?? 10);
}

/** Clubs aren't for kids. Without a fit check, code applies this rule itself. */
export function adultsOnly(item: Pick<BasketItem, 'kind'>, kids: number[]): boolean {
  return kids.length > 0 && item.kind === 'nightlife';
}

/** Adults-only picks sink to the end of the deck when kids are coming. */
export function familyOrder<T extends Pick<BasketItem, 'kind'>>(items: T[], kids: number[]): T[] {
  if (!kids.length) return items;
  return [...items.filter((item) => !adultsOnly(item, kids)), ...items.filter((item) => adultsOnly(item, kids))];
}
