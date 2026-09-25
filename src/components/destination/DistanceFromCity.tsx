'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { VIEWER_CITIES } from '@/lib/location/browser-position';
import { CITY_CHOICE_KEY } from '@/lib/location/useViewerLocation';
import { estimateRoute } from '@/lib/travel/route-estimate';
import type { GeoPoint } from '@/lib/types';
import { formatMiles } from '@/lib/units';

function readChosenCity(): string | null {
  try {
    return window.sessionStorage.getItem(CITY_CHOICE_KEY);
  } catch {
    return null;
  }
}

const subscribe = () => () => {};

/**
 * "How far is it from me" on the destination page (red team UFR-A10). Uses
 * only a city the traveler chose; device coordinates are never stored, so a
 * device-located traveler is asked to pick a city here instead.
 */
export function DistanceFromCity({ target, labelClassName, linkClassName }: { target: GeoPoint; labelClassName?: string; linkClassName?: string }) {
  const cityName = useSyncExternalStore(subscribe, readChosenCity, () => null);
  const city = VIEWER_CITIES.find((entry) => entry.name === cityName);
  if (!city) {
    return (
      <div>
        <span className={labelClassName}>From you</span>
        <strong><Link className={linkClassName} href="/#world-map">Choose your city for a distance ↗</Link></strong>
      </div>
    );
  }
  const route = estimateRoute({ lat: city.lat, lon: city.lon }, target);
  return (
    <div>
      <span className={labelClassName}>From {city.name.split(',')[0]} · indicative</span>
      <strong>{route.airHours === 0 ? route.label : `≈${formatMiles(route.distanceKm)} · ${route.label}`}</strong>
    </div>
  );
}
