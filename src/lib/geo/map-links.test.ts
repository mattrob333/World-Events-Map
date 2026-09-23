import { describe, expect, it } from 'vitest';
import { googleMapsViewUrl } from './map-links';

describe('Google Maps view links', () => {
  it.each(['satellite', 'terrain'] as const)('opens a %s map centered on the event area', (basemap) => {
    const href = googleMapsViewUrl({ lat: 45.4154, lon: 6.6344 }, basemap);
    expect(href).not.toBeNull();
    const url = new URL(href!);
    expect(url.origin).toBe('https://www.google.com');
    expect(url.pathname).toBe('/maps/@');
    expect(url.searchParams.get('api')).toBe('1');
    expect(url.searchParams.get('map_action')).toBe('map');
    expect(url.searchParams.get('center')).toBe('45.4154,6.6344');
    expect(url.searchParams.get('zoom')).toBe('12');
    expect(url.searchParams.get('basemap')).toBe(basemap);
    expect(href).toContain('center=45.4154%2C6.6344');
  });

  it('supports southern and western hemispheres and a valid custom zoom', () => {
    const url = new URL(googleMapsViewUrl({ lat: -32.8347, lon: -70.1289 }, 'terrain', 14)!);
    expect(url.searchParams.get('center')).toBe('-32.8347,-70.1289');
    expect(url.searchParams.get('zoom')).toBe('14');
  });

  it.each([
    { lat: Number.NaN, lon: 7 },
    { lat: 46, lon: Number.POSITIVE_INFINITY },
    { lat: 90.001, lon: 0 },
    { lat: 0, lon: -180.001 },
  ])('rejects invalid coordinates: %o', (coords) => {
    expect(googleMapsViewUrl(coords, 'satellite')).toBeNull();
  });

  it.each([-1, 1.5, 22, Number.NaN])('rejects invalid zoom %s', (zoom) => {
    expect(googleMapsViewUrl({ lat: 46, lon: 7 }, 'terrain', zoom)).toBeNull();
  });
});
