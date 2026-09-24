'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { VIEWER_CITIES } from '@/lib/location/browser-position';
import type { useViewerLocation } from '@/lib/location/useViewerLocation';
import styles from './discovery.module.css';

type Viewer = ReturnType<typeof useViewerLocation>;

function buttonLabel(viewer: Viewer): string {
  // Locating wins over a chosen city: a pending prompt must show progress (UFR2-J09).
  if (viewer.status === 'locating') return 'Finding you…';
  if (viewer.source === 'chosen' && viewer.cityLabel) return viewer.cityLabel.split(',')[0];
  if (viewer.status === 'granted' && viewer.source === 'browser') return 'Near you';
  return 'Set your location';
}

/**
 * One control for where the traveler is: the pill shows the current place;
 * opening it offers device location or a typed city from the list we can
 * center on. Nothing is looked up remotely.
 */
export function LocationPicker({ viewer }: { viewer: Viewer }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelId = useId();
  const blocked = viewer.status === 'denied' || viewer.deviceFailure === 'denied';

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const needle = query.trim().toLowerCase();
  const matches = VIEWER_CITIES.filter((city) => !needle || city.name.toLowerCase().includes(needle));

  const pick = (name: string) => {
    viewer.chooseCity(name);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className={styles.locationPicker} ref={rootRef}>
      <button
        type="button"
        className={`btn btn-ghost ${styles.locationButton}`}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Location: ${buttonLabel(viewer)}. Change location`}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true" className={styles.locationPin}>◉</span>
        {buttonLabel(viewer)}
        <span aria-hidden="true" className={styles.locationChevron}>▾</span>
      </button>
      {open && (
        <div id={panelId} className={styles.locationPanel} role="dialog" aria-label="Choose your location">
          <button
            type="button"
            className={styles.locationDevice}
            disabled={blocked || viewer.status === 'locating'}
            onClick={() => {
              viewer.retry();
              setOpen(false);
            }}
          >
            <span aria-hidden="true">◎</span>
            {viewer.status === 'locating' ? 'Finding you…' : 'Use my current location'}
          </button>
          {blocked && <p className={styles.locationNote}>Location is blocked in your browser. Pick a city instead.</p>}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (matches.length) pick(matches[0].name);
            }}
          >
            <input
              ref={inputRef}
              className={styles.locationInput}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Type a city"
              aria-label="Type a city"
              maxLength={60}
            />
          </form>
          {matches.length ? (
            <ul className={styles.locationList}>
              {matches.map((city) => (
                <li key={city.name}>
                  <button type="button" aria-current={viewer.cityLabel === city.name || undefined} onClick={() => pick(city.name)}>
                    {city.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.locationNote}>No match. These are the cities we can center on for now: {VIEWER_CITIES.map((city) => city.name.split(',')[0]).join(', ')}.</p>
          )}
        </div>
      )}
    </div>
  );
}
