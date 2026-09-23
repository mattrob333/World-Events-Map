import type { GeoPoint } from '@/lib/types';

/** Fresh, device-derived position; a time zone is never a city fix. */
export function requestBrowserPosition(
  geolocation: Pick<Geolocation, 'getCurrentPosition'>,
  onPosition: (coords: GeoPoint) => void,
  onFailure: (reason: 'denied' | 'unavailable') => void,
): () => void {
  let active = true;
  geolocation.getCurrentPosition((position) => {
    if (!active) return;
    const { latitude, longitude, accuracy } = position.coords;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180 ||
      !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 50_000 ||
      !Number.isFinite(position.timestamp) || Date.now() - position.timestamp > 120_000) {
      onFailure('unavailable');
      return;
    }
    // City-scale context only; do not retain precise coordinates.
    onPosition({ lat: Math.round(latitude * 10) / 10, lon: Math.round(longitude * 10) / 10 });
  }, (error) => {
    if (active) onFailure(error.code === 1 ? 'denied' : 'unavailable');
  }, { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 });
  return () => { active = false; };
}

export const VIEWER_CITIES = [
  { name: 'Atlanta, Georgia', lat: 33.75, lon: -84.39 },
  { name: 'New York', lat: 40.71, lon: -74.01 },
  { name: 'Miami', lat: 25.76, lon: -80.19 },
  { name: 'Chicago', lat: 41.88, lon: -87.63 },
  { name: 'Los Angeles', lat: 34.05, lon: -118.24 },
  { name: 'San Francisco', lat: 37.77, lon: -122.42 },
  { name: 'London', lat: 51.51, lon: -0.13 },
  { name: 'Paris', lat: 48.86, lon: 2.35 },
  { name: 'Tokyo', lat: 35.68, lon: 139.69 },
  { name: 'Singapore', lat: 1.35, lon: 103.82 },
  { name: 'Sydney', lat: -33.87, lon: 151.21 },
] as const;
