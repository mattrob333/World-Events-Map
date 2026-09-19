'use client';

import { useCallback, useEffect, useState } from 'react';
import type { GeoPoint } from '@/lib/types';

export type ViewerLocationStatus =
  | 'booting'
  | 'locating'
  | 'granted'
  | 'denied'
  | 'unavailable';

export type ViewerLocationSource = 'none' | 'timezone' | 'browser';

export interface ViewerLocationState {
  /** Current ephemeral location context, browser-refined when permission allows. */
  coords: GeoPoint | null;
  /** Frozen first-paint viewpoint so browser refinement animates instead of snapping. */
  launchCoords: GeoPoint | null;
  status: ViewerLocationStatus;
  source: ViewerLocationSource;
}

const GLOBAL_FALLBACK: GeoPoint = { lat: 20, lon: -30 };

function coarse(value: number) {
  return Math.round(value * 10) / 10;
}

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
 * Ephemeral launch context only. MERIDIAN deliberately does not persist these
 * coordinates into the member profile, People Graph, localStorage, or a server.
 */
export function useViewerLocation() {
  const [state, setState] = useState<ViewerLocationState>({
    coords: null,
    launchCoords: null,
    status: 'booting',
    source: 'none',
  });

  const requestLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState((current) => ({ ...current, status: 'unavailable' }));
      return;
    }

    setState((current) => ({ ...current, status: 'locating' }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState((current) => ({
          ...current,
          coords: {
            lat: coarse(position.coords.latitude),
            lon: coarse(position.coords.longitude),
          },
          status: 'granted',
          source: 'browser',
        }));
      },
      (error) => {
        setState((current) => ({
          ...current,
          status: error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable',
        }));
      },
      {
        enableHighAccuracy: false,
        timeout: 6500,
        maximumAge: 15 * 60 * 1000,
      },
    );
  }, []);

  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const fallback = fallbackForTimeZone(timeZone);
    setState({
      coords: fallback,
      launchCoords: fallback,
      status: 'locating',
      source: 'timezone',
    });

    const timer = window.setTimeout(requestLocation, 0);
    return () => window.clearTimeout(timer);
  }, [requestLocation]);

  return {
    ...state,
    retry: requestLocation,
  };
}
