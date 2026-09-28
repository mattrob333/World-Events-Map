import { describe, expect, it } from 'vitest';
import { forYou, homeEvents } from './home';
import { countryAt, countryFromCalendar, regionAround } from '@/lib/geo/homeCountry';
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
    // A loved team is a reason for its own games, not for every sports event.
    const xGames = event('x-games', { name: 'X Games Aspen', tagline: 'SuperPipe and Big Air at Buttermilk', category: 'ski' as WorldEvent['category'], city: 'Aspen' });
    expect(forYou(xGames, [signal('sports:team:atlanta-braves', 'Atlanta Braves')])).toBeNull();
    expect(forYou(event('braves', { name: 'Braves vs Mets', category: 'sports' as WorldEvent['category'] }), [signal('sports:team:braves', 'Braves')])).toBe('Braves');
  });
});

describe('home country', () => {
  it('finds the country for a point, the smallest box first', () => {
    expect(countryAt({ lat: 41.26, lon: -95.93 })?.code).toBe('US');
    expect(countryAt({ lat: 46.5, lon: 8 })?.code).toBe('CH');
    expect(countryAt({ lat: 48.85, lon: 2.35 })?.code).toBe('FR');
    expect(countryAt({ lat: -1.29, lon: 36.82 })).toBeNull();
    // Across the borders: Canada and Mexico aren't the US, and the US isn't Mexico.
    expect(countryAt({ lat: 43.65, lon: -79.38 })?.code).toBe('CA'); // Toronto
    expect(countryAt({ lat: 49.28, lon: -123.12 })?.code).toBe('CA'); // Vancouver
    expect(countryAt({ lat: 45.5, lon: -73.57 })?.code).toBe('CA'); // Montreal
    expect(countryAt({ lat: 42.89, lon: -78.88 })?.code).toBe('US'); // Buffalo
    expect(countryAt({ lat: 47.61, lon: -122.33 })?.code).toBe('US'); // Seattle
    expect(countryAt({ lat: 29.42, lon: -98.49 })?.code).toBe('US'); // San Antonio
    expect(countryAt({ lat: 25.77, lon: -80.19 })?.code).toBe('US'); // Miami
    expect(countryAt({ lat: 19.43, lon: -99.13 })?.code).toBe('MX'); // Mexico City
    // Overlapping boxes: the device's time zone settles it.
    expect(countryAt({ lat: 48.58, lon: 7.75 }, 'Europe/Paris')?.code).toBe('FR'); // Strasbourg
    const [w, s, e, n] = regionAround({ lat: -1.29, lon: 36.82 });
    expect(w < 36.82 && e > 36.82 && s < -1.29 && n > -1.29).toBe(true);
  });
});

describe('home from the calendar', () => {
  it('names a country the list lacks from the nearest calendar place, framed around it', () => {
    const calendar = [
      { country: 'Singapore', countryCode: 'SG', coords: { lat: 1.29, lon: 103.85 } },
      { country: 'Singapore', countryCode: 'SG', coords: { lat: 1.3, lon: 103.86 } },
      { country: 'Japan', countryCode: 'JP', coords: { lat: 35.68, lon: 139.69 } },
    ];
    const view = countryFromCalendar({ lat: 1.35, lon: 103.82 }, calendar);
    expect(view?.code).toBe('SG');
    expect(view?.name).toBe('Singapore');
    const [w, s, e, n] = view!.bounds;
    expect(e - w).toBeGreaterThanOrEqual(2);
    expect(n - s).toBeGreaterThanOrEqual(2);
    expect(countryFromCalendar({ lat: -1.29, lon: 36.82 }, calendar)).toBeNull();
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
