'use client';

import { useState } from 'react';
import type { WorldEvent } from '@/lib/types';

/** City-level context until an organizer supplies verified venue coordinates. */
export function VenueMap({ event }: { event: WorldEvent }) {
  const [open, setOpen] = useState(false);
  const { lat, lon } = event.coords;
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
