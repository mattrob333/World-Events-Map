'use client';

import { useState } from 'react';
import { googleMapsViewUrl } from '@/lib/geo/map-links';
import type { WorldEvent } from '@/lib/types';
import { SourceLogo } from '@/components/brand/SourceLogo';

/** City-level context until an organizer supplies verified venue coordinates. */
export function VenueMap({ event, compact = false }: { event: WorldEvent; compact?: boolean }) {
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
        className="btn btn-ghost w-full justify-start"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {open ? 'Close local map ↑' : compact ? 'Explore the map & mountain ↗' : 'Explore the neighborhood ↗'}
      </button>
      {(!compact || open) && (isSkiEvent ? (
        satelliteUrl && terrainUrl ? (
          <div className="space-y-2">
            <p className="eyebrow">Explore the mountain</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <a
                className="btn btn-ghost h-auto min-h-11 justify-start whitespace-normal py-3 text-left"
                href={satelliteUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <SourceLogo source={'google maps'} size={14} className="mr-1.5" />View satellite imagery ↗
              </a>
              <a
                className="btn btn-ghost h-auto min-h-11 justify-start whitespace-normal py-3 text-left"
                href={terrainUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <SourceLogo source={'google maps'} size={14} className="mr-1.5" />Explore terrain &amp; contours ↗
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
            className="btn btn-ghost h-auto min-h-11 w-full justify-start whitespace-normal py-3 text-left"
            href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <SourceLogo source={'google maps'} size={14} className="mr-1.5" />Step into {event.city} · Street View ↗
          </a>
          <p className="text-[11px] leading-relaxed text-ink-muted">Street View opens in Google Maps where coverage is available. Imagery may be historical.</p>
        </>
      ))}
      {open && (
        <>
          <p className="text-sm text-ink-muted">
            World / {event.city} / Neighborhood
          </p>
          <iframe
            title={`Neighborhood map of ${event.city}`}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-64 w-full rounded-[var(--radius-control)] border-0 shadow-[var(--shadow-soft-1)]"
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
                  <SourceLogo source={'google maps'} size={13} className="mr-1" />{venue} ↗
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
