import { describe, expect, it } from 'vitest';
import type { ResearchSection, ResearchSpot } from '@/lib/research/destinationSources';
import { basketItems, pickKindFor, profileLikes, schedulePicks } from './basket';
import { emptyProfile } from './profile';

const spot = (id: string, name: string, category?: string): ResearchSpot => ({ id, name, category, source: 'Google Maps', url: `https://maps.google.com/?cid=${id}`, lat: 38.7, lng: -9.1 });
const ok = (items: ResearchSpot[]): ResearchSection<ResearchSpot> => ({ status: 'ok', source: 'Google Maps', fetchedAt: '2026-09-24T10:00:00Z', items });
const empty: ResearchSection<ResearchSpot> = { status: 'unavailable', source: 'Yelp', fetchedAt: null, items: [] };

describe('basket glue', () => {
  it('reads what kind of stop a listing is', () => {
    expect(pickKindFor('food', spot('1', 'Pastéis de Belém', 'Bakery'))).toBe('breakfast');
    expect(pickKindFor('food', spot('2', 'Cervejaria Ramiro', 'Seafood'))).toBe('dinner');
    expect(pickKindFor('nightlife', spot('3', 'Lux Frágil', 'Nightclub'))).toBe('nightlife');
    expect(pickKindFor('nightlife', spot('4', 'Park Bar', 'Rooftop bar'))).toBe('drinks');
    expect(pickKindFor('topSpots', spot('5', 'Belém Tower', 'Monument'))).toBe('sight');
    expect(pickKindFor('hiddenGems', spot('6', 'Sintra hike', 'Trail'))).toBe('activity');
  });

  it('collects fetched listings across tabs, deduped by name, skipping empty sections', () => {
    const items = basketItems({
      topSpots: ok([spot('a', 'Belém Tower'), spot('b', 'LX Factory')]),
      hiddenGems: ok([spot('c', 'belem tower!')]),
      food: ok([spot('d', 'Ramiro', 'Seafood')]),
      nightlife: ok([]), tripadvisor: empty, yelp: empty,
    });
    expect(items.map((item) => item.id)).toEqual(['a', 'b', 'd']);
    expect(items[2]!.kind).toBe('dinner');
  });

  it('turns the profile into likes and keeps swipe order as priority', () => {
    expect(profileLikes({ ...emptyProfile(), food: ['omakase'], teams: ['Atlanta Braves'], music: ['house', 'ok'] })).toEqual(['omakase', 'house', 'Atlanta Braves']);
    const picks = schedulePicks(Array.from({ length: 7 }, (_, i) => ({ ...spot(String(i), `P${i}`), section: 'topSpots' as const, kind: 'sight' as const })));
    expect(picks.map((pick) => pick.priority)).toEqual([5, 5, 5, 4, 4, 4, 3]);
  });
});
