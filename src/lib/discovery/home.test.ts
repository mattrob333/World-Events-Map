import { describe, expect, it } from 'vitest';
import { forYou, homeEvents } from './home';
import { countryAt, regionAround } from '@/lib/geo/homeCountry';
import { snowLevel, SNOW_SPOTS } from '@/lib/geo/snowSeasons';
import type { WorldEvent } from '@/lib/types';
import type { Signal } from '@/lib/vibe/signals';

const event = (id: string, extra: Partial<WorldEvent>) => ({ id, name: id, tagline: '', category: 'music', city: 'Austin', country: 'United States', countryCode: 'US', coords: { lat: 30.27, lon: -97.74 }, start: '2026-10-02', end: '2026-10-04', tags: [], venues: [], ...extra }) as unknown as WorldEvent;
const signal = (key: string, label: string, strength: Signal['strength'] = 'love'): Signal => ({ key, label, strength, source: 'said' });

describe('home events', () => {
  it('keeps what is on or coming in the country within the window, soonest first', () => {
    const list = homeEvents([
      event('later', { start: '2026-12-01', end: '2026-12-02' }),
      event('soon', {}),
      event('past', { start: '2026-09-01', end: '2026-09-02' }),
      event('abroad', { countryCode: 'FR' }),
      event('too-far', { start: '2027-06-01', end: '2027-06-02' }),
      event('on-now', { start: '2026-09-25', end: '2026-09-28' }),
    ], 'US', '2026-09-27');
    expect(list.map((e) => e.id)).toEqual(['on-now', 'soon', 'later']);
  });

  it('calls out a named artist or team, a loved scene, and nothing for avoids', () => {
    const acl = event('acl', { name: 'Austin City Limits', tagline: 'Two weekends in Zilker Park', tags: ['festival', 'indie'], venues: ['Zilker Park'] });
    expect(forYou(event('x', { name: 'An evening with Fred Again..' }), [signal('music:artist:fred-again', 'Fred again')])).toBe('Fred again');
    expect(forYou(acl, [signal('music:genre:indie', 'Indie')])).toBe('Indie');
    expect(forYou(acl, [signal('music:live', 'Live music')])).toBe('Live music');
    expect(forYou(acl, [signal('music:live', 'Live music', 'avoid')])).toBeNull();
    expect(forYou(event('race', { category: 'motorsport' as WorldEvent['category'] }), [signal('culture:museums', 'Museums')])).toBeNull();
  });
});

describe('home country', () => {
  it('finds the country for a point, the smallest box first', () => {
    expect(countryAt({ lat: 41.26, lon: -95.93 })?.code).toBe('US');
    expect(countryAt({ lat: 46.5, lon: 8 })?.code).toBe('CH');
    expect(countryAt({ lat: 48.85, lon: 2.35 })?.code).toBe('FR');
    expect(countryAt({ lat: -1.29, lon: 36.82 })).toBeNull();
    const [w, s, e, n] = regionAround({ lat: -1.29, lon: 36.82 });
    expect(w < 36.82 && e > 36.82 && s < -1.29 && n > -1.29).toBe(true);
  });
});

describe('snow seasons', () => {
  it('reads a month as peak, season, edge or off for each region', () => {
    expect(snowLevel('rockies', 2)).toBe('peak');
    expect(snowLevel('rockies', 12)).toBe('season');
    expect(snowLevel('rockies', 11)).toBe('edge');
    expect(snowLevel('rockies', 7)).toBe('off');
    expect(snowLevel('south', 7)).toBe('peak');
    expect(snowLevel('alps', 1)).toBe('season');
  });

  it('covers the Rockies, the Alps, Japan and the south with real coordinates', () => {
    const regions = new Set(SNOW_SPOTS.map((spot) => spot.region));
    expect([...regions].sort()).toEqual(['alps', 'japan', 'northeast', 'rockies', 'south']);
    for (const spot of SNOW_SPOTS) expect(Math.abs(spot.lat) <= 90 && Math.abs(spot.lon) <= 180).toBe(true);
  });
});
