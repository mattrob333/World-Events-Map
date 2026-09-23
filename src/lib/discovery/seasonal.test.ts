import { describe, expect, it } from 'vitest';
import { EVENTS } from '@/lib/data/events';
import { eventSeason, isSkiTripWindow, orderShortlistEvents, selectSeasonalEvents } from './seasonal';

const focus = '2026-09-22';

describe('editorial seasonal discovery', () => {
  it('makes winter ski a real shortlist across ski destinations', () => {
    const picks = selectSeasonalEvents(EVENTS, focus, 'winter', 'ski');
    expect(picks.length).toBeGreaterThanOrEqual(6);
    expect(picks.every((event) => event.category === 'ski' && eventSeason(event) === 'winter')).toBe(true);
    expect(picks.map((event) => event.city)).toContain('Aspen');
    expect(picks.map((event) => event.city)).toContain('Courchevel');
    expect(orderShortlistEvents(picks, 'ski').slice(0, 6).every(isSkiTripWindow)).toBe(true);
    expect(orderShortlistEvents(picks, 'ski')[0].name).toMatch(/Week/);
  });

  it('lets other seasons and activities surface different curated occasions', () => {
    const summerCoast = selectSeasonalEvents(EVENTS, focus, 'summer', 'coast');
    const fallAdventure = selectSeasonalEvents(EVENTS, focus, 'fall', 'adventure');
    expect(summerCoast.length).toBeGreaterThan(0);
    expect(summerCoast.every((event) => eventSeason(event) === 'summer')).toBe(true);
    expect(summerCoast.some((event) => event.id === 'hanifaru-manta-aggregation')).toBe(true);
    expect(summerCoast.some((event) => event.city === 'Sossusvlei' || event.id === 'monaco-grand-prix')).toBe(false);
    expect(fallAdventure.some((event) => event.id === 'pushkar-camel-fair')).toBe(true);
  });

  it('does not show past calendar entries as current possibilities', () => {
    expect(selectSeasonalEvents(EVENTS, '2027-10-01', 'winter', 'ski')).toEqual([]);
  });
});
