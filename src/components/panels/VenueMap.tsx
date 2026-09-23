'use client';

import { useState } from 'react';
import { googleMapsViewUrl } from '@/lib/geo/map-links';
import type { WorldEvent } from '@/lib/types';

/** City-level context until an organizer supplies verified venue coordinates. */
export function VenueMap({ event }: { event: WorldEvent }) {
  const [open, setOpen] = useState(false);
  const { lat, lon } = event.coords;
  const isSkiEvent = event.category === 'ski' || event.secondaryCategories?.includes('ski');
  const satelliteUrl = isSkiEvent ? googleMapsViewUrl(event.coords, 'satellite') : null;
  const terrainUrl = isSkiEvent ? googleMapsViewUrl(event.coords, 'terrain') : null;
  const box = [
    Math.max(-180, lon - 0.035),
    Math.max(-85, lat - 0.025),
    Math.min(180, lon + 0.035),
    Math.min(85, lat + 0.025),
  ].join(',');
  return (
    <div className="space-y-3">
      <button
        type="button"
        className="w-full rounded-xl border border-brass/40 px-4 py-3 text-left text-sm text-brass-bright"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {open ? 'Close local map ↑' : 'Explore the neighborhood ↗'}
      </button>
      {isSkiEvent ? (
        satelliteUrl && terrainUrl ? (
          <div className="space-y-2">
            <p className="label-sm text-brass">Explore the mountain</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <a
                className="rounded-xl border border-signal/30 bg-signal/5 px-4 py-3 text-sm text-signal"
                href={satelliteUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                View satellite imagery ↗
              </a>
              <a
                className="rounded-xl border border-brass/40 bg-brass/5 px-4 py-3 text-sm text-brass-bright"
                href={terrainUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Explore terrain &amp; contours ↗
              </a>
            </div>
            <p className="text-[11px] leading-relaxed text-ink-muted">
              Opens Google Maps near {event.city}. The map starts at the approximate event area, not a verified lift or venue entrance. Zoom and pan to explore the mountains.
            </p>
          </div>
        ) : null
      ) : (
        <>
          <a
            className="block w-full rounded-xl border border-signal/30 bg-signal/5 px-4 py-3 text-sm text-signal"
            href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Step into {event.city} · Street View ↗
          </a>
          <p className="text-[11px] leading-relaxed text-ink-muted">Street View opens in Google Maps where coverage is available. Imagery may be historical.</p>
        </>
      )}
      {open && (
        <>
          <p className="text-sm text-ink-muted">
            World / {event.city} / Neighborhood
          </p>
          <iframe
            title={`Neighborhood map of ${event.city}`}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-64 w-full rounded-xl border-0"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(box)}&layer=mapnik`}
          />
          <p className="text-xs leading-relaxed text-ink-muted">
            Approximate event area, not a verified entrance. Map data ©
            OpenStreetMap contributors. Confirm the exact venue with your host.
          </p>
          <a className="inline-block text-xs text-brass underline underline-offset-4" target="_blank" rel="noopener noreferrer" href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`}>Open the full neighborhood map ↗</a>
          <ul className="space-y-2">
            {event.venues.map((venue) => (
              <li key={venue}>
                <a
                  className="text-sm text-brass-bright underline underline-offset-4"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue}, ${event.city}, ${event.country}`)}`}
                >
                  {venue} ↗
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
