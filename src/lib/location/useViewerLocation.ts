'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GeoPoint } from '@/lib/types';
import { requestBrowserPosition, VIEWER_CITIES } from './browser-position';
import { loadCities, nearestCity } from './nearestCity';

export type ViewerLocationStatus =
  | 'booting'
  /** Not requested: dope.travel only asks after the traveler taps. */
  | 'idle'
  | 'locating'
  | 'granted'
  | 'denied'
  | 'unavailable';

export type ViewerLocationSource = 'none' | 'timezone' | 'browser' | 'chosen';

export interface ViewerLocationState {
  /** Current ephemeral location context, browser-refined when permission allows. */
  coords: GeoPoint | null;
  /** Frozen first-paint viewpoint so browser refinement animates instead of snapping. */
  launchCoords: GeoPoint | null;
  status: ViewerLocationStatus;
  source: ViewerLocationSource;
  cityLabel?: string;
  /** The city a device fix is in ("Atlanta, Georgia"), worked out on the device. */
  placeLabel?: string;
  /** "Atlanta", or "Near Atlanta" when the fix is out of town. */
  placeShort?: string;
  /** Why the last device request failed while a chosen city stayed in use. */
  deviceFailure?: 'denied' | 'unavailable';
}

/**
 * A failed device request never discards a city the traveler chose; it keeps
 * that city and records why the device fix did not arrive (red team UFR-A04).
 */
export function applyDeviceFailure(
  current: ViewerLocationState,
  reason: 'denied' | 'unavailable',
): ViewerLocationState {
  if (current.source === 'chosen' && current.coords) {
    return { ...current, status: 'granted', deviceFailure: reason };
  }
  return { ...current, status: reason, deviceFailure: reason };
}

const GLOBAL_FALLBACK: GeoPoint = { lat: 20, lon: -30 };
export const CITY_CHOICE_KEY = 'meridian.viewing-city';

/**
 * Gives first paint a relevant hemisphere without pretending we know the
 * viewer's exact location. Browser geolocation can refine this a moment later.
 */
export function fallbackForTimeZone(timeZone: string): GeoPoint {
  if (/New_York|Toronto|Detroit|Indiana|Kentucky|Montreal/.test(timeZone)) {
    return { lat: 40, lon: -75 };
  }
  if (/Chicago|Winnipeg/.test(timeZone)) return { lat: 40, lon: -91 };
  if (/Denver|Edmonton/.test(timeZone)) return { lat: 40, lon: -105 };
  if (/Los_Angeles|Vancouver|Tijuana/.test(timeZone)) return { lat: 38, lon: -122 };
  if (/Anchorage/.test(timeZone)) return { lat: 61, lon: -149 };
  if (/Honolulu/.test(timeZone)) return { lat: 21, lon: -157 };

  if (timeZone.startsWith('America/')) return { lat: 19, lon: -79 };
  if (timeZone.startsWith('Europe/')) return { lat: 48, lon: 10 };
  if (timeZone.startsWith('Africa/')) return { lat: 2, lon: 22 };
  if (timeZone.startsWith('Asia/')) return { lat: 27, lon: 98 };
  if (timeZone.startsWith('Australia/')) return { lat: -27, lon: 134 };
  if (timeZone.startsWith('Pacific/')) return { lat: -12, lon: 170 };
  if (timeZone.startsWith('Indian/')) return { lat: -18, lon: 62 };

  return GLOBAL_FALLBACK;
}

/**
 * Ephemeral launch context only. dope.travel deliberately does not persist these
 * coordinates into the member profile, People Graph, localStorage, or a server.
 */
export function useViewerLocation() {
  const cancelRequest = useRef<(() => void) | null>(null);
  // A city chosen while the permission check is in flight must win.
  const cityChosen = useRef(false);
  const [state, setState] = useState<ViewerLocationState>({
    coords: null,
    launchCoords: null,
    status: 'booting',
    source: 'none',
  });

  const requestLocation = useCallback(() => {
    cancelRequest.current?.();
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState((current) => applyDeviceFailure(current, 'unavailable'));
      return;
    }

    setState((current) => ({ ...current, status: 'locating', deviceFailure: undefined }));

    cancelRequest.current = requestBrowserPosition(navigator.geolocation,
      (coords) => {
        // The chosen city is forgotten only once a device fix actually arrives.
        try { sessionStorage.removeItem(CITY_CHOICE_KEY); } catch { /* Storage can be disabled. */ }
        setState((current) => ({
          ...current,
          coords,
          status: 'granted',
          source: 'browser',
          cityLabel: undefined,
          placeLabel: undefined,
          placeShort: undefined,
          deviceFailure: undefined,
        }));
        // Name the city from a list that ships with the site; the fix never leaves the device.
        void loadCities().then((cities) => {
          const place = nearestCity(coords, cities);
          if (!place) return;
          setState((current) => current.source === 'browser' && current.coords === coords
            ? { ...current, placeLabel: place.region ? `${place.name}, ${place.region}` : place.name, placeShort: place.label }
            : current);
        });
      },
      (reason) => {
        if (reason !== 'denied' || !navigator.permissions?.query) {
          setState((current) => applyDeviceFailure(current, reason));
          return;
        }
        // A dismissed prompt also reports "denied", but the browser will ask again:
        // only a real block (permission state "denied") disables the button.
        void navigator.permissions.query({ name: 'geolocation' as PermissionName })
          .then((permission) => permission.state === 'denied' ? 'denied' : 'unavailable', () => 'denied' as const)
          .then((settled) => setState((current) => applyDeviceFailure(current, settled)));
      },
    );
  }, []);

  const chooseCity = useCallback((name: string) => {
    const city = VIEWER_CITIES.find((entry) => entry.name === name);
    if (!city) return;
    cancelRequest.current?.();
    cityChosen.current = true;
    // Remember only an explicitly chosen public city, never device coordinates.
    try { sessionStorage.setItem(CITY_CHOICE_KEY, city.name); } catch { /* In-memory choice still works. */ }
    setState((current) => ({ ...current, coords: { lat: city.lat, lon: city.lon }, status: 'granted', source: 'chosen', cityLabel: city.name, placeLabel: undefined, placeShort: undefined, deviceFailure: undefined }));
  }, []);

  useEffect(() => {
    let cityName: string | null = null;
    try { cityName = sessionStorage.getItem(CITY_CHOICE_KEY); } catch { /* Storage can be disabled. */ }
    const city = VIEWER_CITIES.find((entry) => entry.name === cityName);
    if (city) {
      const coords = { lat: city.lat, lon: city.lon };
      setState({ coords, launchCoords: coords, source: 'chosen', status: 'granted', cityLabel: city.name });
      return () => cancelRequest.current?.();
    }
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const fallback = fallbackForTimeZone(timeZone);
    setState({
      coords: fallback,
      launchCoords: fallback,
      status: 'idle',
      source: 'timezone',
    });

    // Never prompt on page load (red team UFR-A05). Only a browser that has
    // already granted permission is used without a tap; a blocked one is
    // reported so the button can say so instead of silently doing nothing.
    let active = true;
    const permissions = typeof navigator !== 'undefined' ? navigator.permissions : undefined;
    void permissions?.query({ name: 'geolocation' as PermissionName })
      .then((permission) => {
        if (!active) return;
        if (permission.state === 'granted' && !cityChosen.current) requestLocation();
        else if (permission.state === 'denied') setState((current) => ({ ...current, status: 'denied', deviceFailure: 'denied' }));
      })
      .catch(() => { /* Permissions API unsupported: wait for a tap. */ });
    return () => { active = false; cancelRequest.current?.(); };
  }, [requestLocation]);

  return {
    ...state,
    retry: requestLocation,
    chooseCity,
  };
}
