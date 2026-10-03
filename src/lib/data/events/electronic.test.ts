import { describe, expect, it } from 'vitest';
import { EVENT_INDEX } from './index';
import { ELECTRONIC_EVENTS, FESTIVALS } from './electronic';

describe('electronic festival catalog', () => {
  it('lists every festival with its facts, sources and the official site', () => {
    expect(FESTIVALS.length).toBeGreaterThan(150);
    for (const festival of FESTIVALS) {
      expect(festival.sources.length, festival.id).toBeGreaterThan(0);
      expect(festival.officialUrl, festival.id).toMatch(/^https:\/\//);
      expect(festival.start <= festival.end, festival.id).toBe(true);
      expect(festival.description, festival.id).not.toMatch(/window|estimated|not announced|coordinates are/i);
    }
  });

  it('carries no modeled demand or spend, and says so through listing', () => {
    for (const event of ELECTRONIC_EVENTS) {
      expect(Object.values(event.signals).every((value) => value === 0), event.id).toBe(true);
      expect(event.estimatedSpend).toEqual({ min: 0, max: 0, currency: 'USD' });
      expect(event.listing?.sources.length, event.id).toBeGreaterThan(0);
      expect(event.tagline.length, event.id).toBeLessThanOrEqual(90);
      expect(event.whyGo.every((line) => line.length <= 80), event.id).toBe(true);
    }
  });

  it('marks unannounced dates as projected, never as firm', () => {
    for (const festival of FESTIVALS) {
      const event = EVENT_INDEX.get(festival.id)!;
      if (festival.datesStatus === 'usual_window') expect(event.datesStatus, festival.id).toBe('projected');
    }
  });

  it('has Zamna Tulum with its announced 10th season', () => {
    const zamna = EVENT_INDEX.get('zamna-tulum')!;
    expect(zamna).toMatchObject({ city: 'Tulum', countryCode: 'MX', start: '2026-12-31', end: '2027-01-10', tier: 'legendary' });
    expect(zamna.datesStatus).toBeUndefined();
    expect(zamna.listing?.officialUrl).toBe('https://zamnafestival.com');
  });

  it('does not duplicate a festival already on the calendar', () => {
    expect(ELECTRONIC_EVENTS.some((event) => /tomorrowland belgium|^ultra music festival$/i.test(event.name))).toBe(false);
  });
});
