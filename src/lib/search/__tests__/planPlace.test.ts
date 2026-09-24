import { describe, expect, it } from 'vitest';
import { buildSearchCatalog, searchCatalog } from '../catalog';
import { planPlaceFromParams, planPlaceFromQuery, planTripHref, planTripOffer } from '../planPlace';

describe('plan a trip from search', () => {
  it('reads a place and an optional region', () => {
    expect(planPlaceFromQuery('  Lisbon ,  Portugal ')).toEqual({ place: 'Lisbon', region: 'Portugal' });
    expect(planPlaceFromQuery('São Paulo')).toEqual({ place: 'São Paulo' });
    expect(planPlaceFromQuery("L'Aquila")).toEqual({ place: "L'Aquila" });
  });

  it('ignores queries that do not look like places', () => {
    for (const query of ['', 'a', '<img onerror=x>', 'https://evil.test', '1234', 'one two three four five six seven']) {
      expect(planPlaceFromQuery(query)).toBeNull();
    }
  });

  it('links to the designer with the place and region encoded', () => {
    expect(planTripHref({ place: 'Munich', region: 'Germany' })).toBe('/trips/designer?place=Munich&region=Germany');
    expect(planTripHref({ place: 'Tbilisi' })).toBe('/trips/designer?place=Tbilisi');
  });

  it('offers a trip only when the editorial calendar has no match', () => {
    const catalog = buildSearchCatalog('2026-09-24');
    expect(planTripOffer('Tbilisi', searchCatalog('Tbilisi', catalog))?.href).toBe('/trips/designer?place=Tbilisi');
    expect(planTripOffer('Aspen', searchCatalog('Aspen', catalog))).toBeNull();
    expect(planTripOffer('<b>', searchCatalog('<b>', catalog))).toBeNull();
  });

  it('reads designer params with the same rules', () => {
    expect(planPlaceFromParams(new URLSearchParams('place=Munich&region=Germany'))).toEqual({ place: 'Munich', region: 'Germany' });
    expect(planPlaceFromParams(new URLSearchParams('place=Lisbon%2C%20Portugal'))).toEqual({ place: 'Lisbon', region: 'Portugal' });
    expect(planPlaceFromParams(new URLSearchParams('place=%3Cscript%3E'))).toBeNull();
    expect(planPlaceFromParams(new URLSearchParams('region=Germany'))).toBeNull();
  });
});

describe('planPlaceFromQuery: nonsense is not a place (retest N4)', () => {
  it('rejects keyboard mash and accepts real names', () => {
    for (const junk of ['qwzxv', 'asdfgh', 'xkcdbrrrt']) expect(planPlaceFromQuery(junk)).toBeNull();
    for (const real of ['Lisbon', 'Cwm', 'Szczecin', 'São Paulo', 'Munich, Germany']) expect(planPlaceFromQuery(real)).not.toBeNull();
  });
});
