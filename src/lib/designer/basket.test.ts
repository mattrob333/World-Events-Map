import { describe, expect, it } from 'vitest';
import type { ResearchSection, ResearchSpot } from '@/lib/research/destinationSources';
import { adultsOnly, basketItems, crewLine, familyOrder, kidAges, lodgingGuess, pickKindFor, planWindow, profileLikes, schedulePicks } from './basket';
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
    expect(profileLikes({ ...emptyProfile(), food: ['omakase'], teams: ['Atlanta Braves'], music: ['house', 'ok'] })).toEqual(['omakase']);
    const picks = schedulePicks(Array.from({ length: 7 }, (_, i) => ({ ...spot(String(i), `P${i}`), section: 'topSpots' as const, kind: 'sight' as const })));
    expect(picks.map((pick) => pick.priority)).toEqual([5, 5, 5, 4, 4, 4, 3]);
  });
});

describe('fitting picks into the trip', () => {
  it('leaves arrival and departure days for travel', () => {
    expect(planWindow('2026-11-24', 7)).toMatchObject({ startDate: '2026-11-25', days: 6 });
    expect(planWindow('2026-11-24', 2)).toMatchObject({ startDate: '2026-11-25', days: 1 });
    expect(planWindow('2026-11-24', 1)).toMatchObject({ startDate: '2026-11-24', days: 1, dayStart: '15:00' });
    expect(planWindow('2026-12-30', 40).days).toBe(14);
  });

  it('puts the stand-in for lodging in town, not out at a day trip', () => {
    const town = [{ lat: 38.71, lng: -9.14 }, { lat: 38.72, lng: -9.13 }, { lat: 38.70, lng: -9.15 }, { lat: 38.80, lng: -9.39 }];
    const guess = lodgingGuess(town)!;
    expect(guess.lng).toBeGreaterThan(-9.16);
    expect(lodgingGuess([{ lat: 1, lng: 1 }])).toBeUndefined();
  });

  it('names kids once and keeps clubs off a family plan', () => {
    const crew = [{ name: 'You', kind: 'adult' as const }, { name: 'Son (8)', kind: 'kid' as const, age: 8 }, { name: 'Ana', kind: 'kid' as const, age: 12 }];
    expect(crewLine(crew)).toBe('1 adult, kids aged 8 and 12');
    expect(crewLine(crew)).not.toMatch(/Ana|Son|You/);
    const kids = kidAges(crew);
    expect(adultsOnly({ kind: 'nightlife' }, kids)).toBe(true);
    expect(adultsOnly({ kind: 'nightlife' }, [])).toBe(false);
    expect(familyOrder([{ kind: 'nightlife' as const, id: 'a' }, { kind: 'sight' as const, id: 'b' }], kids).map((item) => item.id)).toEqual(['b', 'a']);
  });
});
