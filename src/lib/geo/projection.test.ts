import { describe, expect, it } from 'vitest';
import { GOLF_EVENTS } from '@/lib/data/events/golf';
import { VIEWER_CITIES } from '@/lib/location/browser-position';
import { greatCircleDistanceKm, latLonToVec3, vec3ToLatLon } from './projection';

describe('viewer marker projection', () => {
  it('places selected Atlanta in Georgia, south of the Medinah event beacon', () => {
    const atlanta = VIEWER_CITIES.find((city) => city.name === 'Atlanta, Georgia');
    const medinah = GOLF_EVENTS.find((event) => event.id === 'presidents-cup');
    expect(atlanta).toBeDefined();
    expect(medinah).toBeDefined();
    if (!atlanta || !medinah) return;

    const viewerPoint = latLonToVec3(atlanta.lat, atlanta.lon);
    const eventPoint = latLonToVec3(medinah.coords.lat, medinah.coords.lon);
    const roundTrip = vec3ToLatLon(viewerPoint);

    expect(roundTrip.lat).toBeCloseTo(33.75, 2);
    expect(roundTrip.lon).toBeCloseTo(-84.39, 2);
    expect(viewerPoint.y).toBeLessThan(eventPoint.y);
    expect(greatCircleDistanceKm(atlanta, medinah.coords)).toBeGreaterThan(800);
  });
});
