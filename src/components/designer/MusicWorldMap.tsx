'use client';

import { geoNaturalEarth1, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import type { FeatureCollection } from 'geojson';
import { useEffect, useMemo, useState } from 'react';
import type { EventKind, LiveEvent } from '@/lib/designer/concerts';
import styles from './designer.module.css';

const WIDTH = 960;
const HEIGHT = 480;

export const KIND_STYLE: Record<EventKind, { color: string; label: string }> = {
  festival: { color: '#f472b6', label: 'Festival with your artist' },
  artist: { color: '#fb923c', label: 'Your artist live' },
  tribute: { color: '#4ade80', label: 'Tribute or cover act' },
  scene: { color: '#60a5fa', label: 'Your kind of night' },
  game: { color: '#fde047', label: 'Your team plays' },
};

const KIND_RANK: EventKind[] = ['festival', 'artist', 'game', 'tribute', 'scene'];

type Pin = { key: string; x: number; y: number; city: string; events: LiveEvent[]; kind: EventKind };

let countriesCache: Promise<FeatureCollection | null> | null = null;
function loadCountries() {
  countriesCache ??= fetch('/geo/countries-110m.geo.json')
    .then((response) => (response.ok ? (response.json() as Promise<FeatureCollection>) : null))
    .catch(() => null);
  return countriesCache;
}

/** Flat world map of real events with coordinates, grouped into city pins. */
export function MusicWorldMap({ events, selected, onSelect }: { events: LiveEvent[]; selected: string | null; onSelect: (key: string | null) => void }) {
  const [countries, setCountries] = useState<FeatureCollection | null>(null);
  useEffect(() => {
    let live = true;
    loadCountries().then((data) => live && setCountries(data));
    return () => {
      live = false;
    };
  }, []);

  const projection = useMemo(() => geoNaturalEarth1().fitSize([WIDTH, HEIGHT], { type: 'Sphere' } as GeoPermissibleObjects), []);
  const path = useMemo(() => geoPath(projection), [projection]);

  const pins = useMemo(() => {
    const groups = new Map<string, Pin>();
    for (const event of events) {
      if (event.lat === undefined || event.lon === undefined) continue;
      const key = `${event.lat.toFixed(1)},${event.lon.toFixed(1)}`;
      const point = projection([event.lon, event.lat]);
      if (!point) continue;
      const pin = groups.get(key) ?? { key, x: point[0], y: point[1], city: event.city ?? 'Venue', events: [], kind: event.kind };
      pin.events.push(event);
      if (KIND_RANK.indexOf(event.kind) < KIND_RANK.indexOf(pin.kind)) pin.kind = event.kind;
      groups.set(key, pin);
    }
    return [...groups.values()].sort((a, b) => a.y - b.y);
  }, [events, projection]);

  return (
    <div className={styles.worldMap}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`World map with ${pins.length} places where your music is playing`}>
        <path d={path({ type: 'Sphere' } as GeoPermissibleObjects) ?? ''} className={styles.mapSphere} />
        {countries?.features.map((feature, index) => (
          <path key={String(feature.id ?? index)} d={path(feature) ?? ''} className={styles.mapLand} />
        ))}
        {pins.map((pin) => {
          const on = pin.key === selected;
          const r = Math.min(14, 5 + pin.events.length * 1.5);
          return (
            <g
              key={pin.key}
              className={styles.mapPin}
              transform={`translate(${pin.x} ${pin.y})`}
              onClick={() => onSelect(on ? null : pin.key)}
              onKeyDown={(event) => (event.key === 'Enter' || event.key === ' ') && onSelect(on ? null : pin.key)}
              tabIndex={0}
              role="button"
              aria-pressed={on}
              aria-label={`${pin.city}: ${pin.events.length} ${pin.events.length === 1 ? 'show' : 'shows'}`}
            >
              <circle r={r + 6} fill={KIND_STYLE[pin.kind].color} opacity={on ? 0.35 : 0.18} />
              <circle r={r} fill={KIND_STYLE[pin.kind].color} stroke={on ? '#fff' : '#16110d'} strokeWidth={on ? 2.5 : 1.5} />
              {pin.events.length > 1 ? (
                <text textAnchor="middle" dy="0.35em" className={styles.mapCount}>
                  {pin.events.length}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <div className={styles.mapLegend}>
        {(Object.keys(KIND_STYLE) as EventKind[])
          .filter((kind) => events.some((event) => event.kind === kind))
          .map((kind) => (
            <span key={kind}>
              <i style={{ background: KIND_STYLE[kind].color }} aria-hidden />
              {KIND_STYLE[kind].label}
            </span>
          ))}
      </div>
    </div>
  );
}

export function pinKey(event: LiveEvent): string | null {
  return event.lat === undefined || event.lon === undefined ? null : `${event.lat.toFixed(1)},${event.lon.toFixed(1)}`;
}
