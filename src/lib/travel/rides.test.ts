import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { homeIata, parseAirports, rideLinks } from './rides';

const airports = parseAirports(readFileSync('public/geo/airports.txt', 'utf8'));

describe('rides to the airport', () => {
  it('knows the big airports by IATA code, with coordinates', () => {
    expect(airports.get('ATL')).toMatchObject({ name: 'Hartsfield Jackson Atlanta International Airport' });
    expect(airports.get('ATL')!.lat).toBeCloseTo(33.64, 1);
    expect(airports.get('ZRH')).toBeTruthy();
    expect(airports.size).toBeGreaterThan(2000);
  });

  it('reads the home airport from what they typed', () => {
    expect(homeIata('Atlanta Georgia (ATL)')).toBe('ATL');
    expect(homeIata('Charlotte, NC')).toBe('CLT');
    expect(homeIata(undefined)).toBeUndefined();
  });

  it('builds Uber and Lyft links that drop off at the airport and pick up where they are', () => {
    const { uber, lyft } = rideLinks(airports.get('ATL')!);
    const u = new URL(uber);
    expect(u.origin).toBe('https://m.uber.com');
    expect(u.searchParams.get('pickup')).toBe('my_location');
    expect(Number(u.searchParams.get('dropoff[latitude]'))).toBeCloseTo(33.6367, 3);
    const l = new URL(lyft);
    expect(l.origin).toBe('https://lyft.com');
    expect(Number(l.searchParams.get('destination[longitude]'))).toBeCloseTo(-84.4281, 3);
  });
});
