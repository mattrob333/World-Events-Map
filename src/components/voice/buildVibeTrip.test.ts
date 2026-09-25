import { describe, expect, it } from 'vitest';
import { buildVibeTrip } from './buildVibeTrip';
import type { CanvasSpot } from '@/lib/voice/canvas';
import { cardLookup } from '@/lib/designer/itinerary';

const spot = (name: string, kind: CanvasSpot['kind'], date?: string): CanvasSpot => ({ id: `spot:x:${name}`, name, kind, why: 'Seen in the search', url: 'https://example.com', host: 'example.com', place: 'Hakuba', date });

describe('buildVibeTrip', () => {
  it('builds the schedule for the place they settled on, with their dates and picks', () => {
    const trip = buildVibeTrip({ place: 'Hakuba', region: 'Japan', kind: 'ski', start: '2099-02-01', nights: 4, spots: [spot('Pizza Hakuba', 'eat'), spot('Hakuba Fire Festival', 'event', '2099-02-03')] });
    expect(trip.place?.name).toBe('Hakuba');
    expect(trip.days[0]!.date).toBe('2099-02-01');
    expect(trip.participants.map((person) => person.name)).toEqual(['You']);
    const cardIds = trip.days.flatMap((day) => day.slots.flatMap((slot) => slot.cardIds));
    const card = cardLookup(trip);
    const names = cardIds.map((id) => card(id)?.title);
    expect(names).toContain('Pizza Hakuba');
    const festivalDay = trip.days.find((day) => day.slots.some((slot) => slot.cardIds.some((id) => card(id)?.title === 'Hakuba Fire Festival')));
    expect(festivalDay?.date).toBe('2099-02-03');
  });

  it('never starts a trip in the past', () => {
    const trip = buildVibeTrip({ place: 'Hakuba', kind: 'ski', start: '2000-01-01', nights: 3, spots: [] });
    expect(trip.days[0]!.date > '2000-01-01').toBe(true);
  });
});
