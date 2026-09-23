import { describe, expect, it } from 'vitest';
import { estimateRoute } from '../route-estimate';

describe('estimateRoute', () => {
  it('gives a plausible city-scale Atlanta to New York preview', () => {
    const route = estimateRoute(
      { lat: 33.75, lon: -84.39 },
      { lat: 40.71, lon: -74.01 },
    );
    expect(route.distanceKm).toBeGreaterThan(1100);
    expect(route.distanceKm).toBeLessThan(1300);
    expect(route.airHours).toBeGreaterThanOrEqual(1.75);
    expect(route.airHours).toBeLessThanOrEqual(2.25);
    expect(route.label).toContain('in the air');
  });

  it('treats two points in the same city as already in the area', () => {
    expect(estimateRoute(
      { lat: 33.75, lon: -84.39 },
      { lat: 33.76, lon: -84.38 },
    )).toMatchObject({ airHours: 0, label: 'Already in the area' });
  });

  it('never implies a short flight between antipodal points', () => {
    const route = estimateRoute({ lat: 0, lon: 0 }, { lat: 0, lon: 180 });
    expect(route.distanceKm).toBeGreaterThan(20_000);
    expect(route.airHours).toBeGreaterThan(24);
  });
});
