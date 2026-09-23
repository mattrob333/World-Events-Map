import { describe, expect, it } from 'vitest';
import { EVENTS } from '@/lib/data/events';
import { recommendTravelIdeas } from './recommend';

const NOW = '2026-09-22';

describe('recommendTravelIdeas', () => {
  it('keeps recommendations current, distinct by destination, and linked to curated reasons', () => {
    const ideas = recommendTravelIdeas(EVENTS, NOW, 'all', 5);
    expect(ideas).toHaveLength(5);
    expect(new Set(ideas.map((idea) => idea.slug)).size).toBe(ideas.length);
    for (const idea of ideas) {
      const event = EVENTS.find((item) => item.id === idea.eventId);
      expect(event).toBeDefined();
      expect(idea.end >= NOW).toBe(true);
      expect(idea.whyGo).toEqual(event?.whyGo.slice(0, 2));
    }
  });

  it('changes the occasion category when an interest is selected', () => {
    const culture = recommendTravelIdeas(EVENTS, NOW, 'culture');
    const water = recommendTravelIdeas(EVENTS, NOW, 'water');
    expect(culture.length).toBeGreaterThan(0);
    expect(water.length).toBeGreaterThan(0);
    expect(culture.every((idea) => ['art', 'cultural', 'design', 'film', 'fashion'].includes(idea.eventCategory))).toBe(true);
    expect(water.every((idea) => idea.eventCategory === 'sailing')).toBe(true);
    expect(culture[0]?.eventId).not.toBe(water[0]?.eventId);
  });

  it('returns an empty list once the curated horizon has passed', () => {
    expect(recommendTravelIdeas(EVENTS, '2030-01-01')).toEqual([]);
  });
});
