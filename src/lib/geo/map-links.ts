import type { GeoPoint } from '@/lib/types';

export type GoogleMapBasemap = 'satellite' | 'terrain';

/** Opens a full, interactive Google map without embedding or fetching map tiles. */
export function googleMapsViewUrl(
  coords: GeoPoint,
  basemap: GoogleMapBasemap,
  zoom = 12,
): string | null {
  if (
    !coords ||
    !Number.isFinite(coords.lat) ||
    !Number.isFinite(coords.lon) ||
    coords.lat < -90 ||
    coords.lat > 90 ||
    coords.lon < -180 ||
    coords.lon > 180 ||
    (basemap !== 'satellite' && basemap !== 'terrain') ||
    !Number.isInteger(zoom) ||
    zoom < 0 ||
    zoom > 21
  ) {
    return null;
  }

  const url = new URL('https://www.google.com/maps/@');
  url.searchParams.set('api', '1');
  url.searchParams.set('map_action', 'map');
  url.searchParams.set('center', `${coords.lat},${coords.lon}`);
  url.searchParams.set('zoom', String(zoom));
  url.searchParams.set('basemap', basemap);
  return url.toString();
}
