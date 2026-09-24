'use client';

import { useEffect, useState } from 'react';
import { preload } from 'react-dom';
import type { PlacePhoto } from './media';

export const placeMediaUrl = (eventId: string) => `/api/place-media?eventId=${encodeURIComponent(eventId)}`;

type Result = { eventId: string; photos: PlacePhoto[] };

/**
 * Commons photos for one catalog event. The request is announced with a
 * `<link rel="preload" as="fetch">` while the page renders (in the server HTML
 * too), so it runs alongside the JavaScript download instead of after hydration;
 * the fetch below then reuses that response. The route sends Cache-Control, so a
 * revisit is served from the browser or CDN cache.
 */
export function usePlacePhotos(eventId: string | null): { ready: boolean; photos: PlacePhoto[] } {
  if (eventId) preload(placeMediaUrl(eventId), { as: 'fetch', crossOrigin: 'anonymous' });
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!eventId) return;
    const controller = new AbortController();
    fetch(placeMediaUrl(eventId), { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<{ photos?: PlacePhoto[] }>) : { photos: [] }))
      .then((data) => {
        if (!controller.signal.aborted) setResult({ eventId, photos: Array.isArray(data.photos) ? data.photos : [] });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ eventId, photos: [] });
      });
    return () => controller.abort();
  }, [eventId]);

  const ready = Boolean(eventId) && result?.eventId === eventId;
  return { ready, photos: ready ? result!.photos : [] };
}
