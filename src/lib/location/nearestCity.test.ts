import { describe, expect, it } from 'vitest';
import { nearestCity, parseCities } from './nearestCity';

const cities = parseCities([
  'Atlanta|Georgia|33.75|-84.39|511',
  'Sandy Springs|Georgia|33.92|-84.38|105',
  'Roswell|Georgia|34.02|-84.36|94',
  'Athens|Georgia|33.96|-83.38|127',
  'Monaco|Monaco|43.73|7.42|38',
].join('\n'));

describe('nearest city on the device', () => {
  it('names the city you are in', () => {
    expect(nearestCity({ lat: 33.8, lon: -84.4 }, cities)).toMatchObject({ name: 'Atlanta', label: 'Atlanta', region: 'Georgia' });
  });
  it('names the big city for a suburb, not the suburb', () => {
    expect(nearestCity({ lat: 33.85, lon: -84.25 }, cities)?.name).toBe('Atlanta');
  });
  it('says "Near" when the fix is a way out of town', () => {
    expect(nearestCity({ lat: 33.6, lon: -83.9 }, cities)?.label).toMatch(/^Near /);
  });
  it('gives up in the middle of nowhere', () => {
    expect(nearestCity({ lat: 0, lon: -140 }, cities)).toBeNull();
  });
  it('ships a real list', async () => {
    const { readFileSync } = await import('node:fs');
    const all = parseCities(readFileSync('public/geo/cities.txt', 'utf8'));
    expect(all.length).toBeGreaterThan(5000);
    expect(nearestCity({ lat: 33.8, lon: -84.4 }, all)?.name).toBe('Atlanta');
    expect(nearestCity({ lat: 48.9, lon: 2.3 }, all)?.name).toBe('Paris');
  });
});
