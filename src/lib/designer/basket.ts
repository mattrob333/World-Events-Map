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

/** The traveler's own likes, for the fit check and the "You said …" line. */
export function profileLikes(profile: TravelerProfile | undefined): string[] {
  if (!profile) return [];
  const artists = profile.artists ?? [];
  return [...new Set([...profile.food, ...profile.interests, ...profile.music, ...artists, ...profile.teams, ...profile.events].map((like) => like.trim()).filter((like) => like.length >= 3))].slice(0, 24);
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
