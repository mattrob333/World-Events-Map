'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { VIEWER_CITIES } from '@/lib/location/browser-position';
import type { useViewerLocation } from '@/lib/location/useViewerLocation';
import styles from './discovery.module.css';

type Viewer = ReturnType<typeof useViewerLocation>;

function buttonLabel(viewer: Viewer): string {
  // Locating wins over a chosen city: a pending prompt must show progress (UFR2-J09).
  if (viewer.status === 'locating') return 'Finding you…';
  if (viewer.source === 'chosen' && viewer.cityLabel) return viewer.cityLabel.split(',')[0];
  if (viewer.status === 'granted' && viewer.source === 'browser') return viewer.placeShort ?? 'Near you';
  return 'Location';
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const panelId = useId();
  const blocked = viewer.status === 'denied' || viewer.deviceFailure === 'denied';

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Escape backs out of the picker only; the page's own Escape (clearing a journey) doesn't also fire.
      event.preventDefault();
      event.stopPropagation();
      setQuery('');
      setOpen(false);
      buttonRef.current?.focus();
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
    buttonRef.current?.focus();
  };

  /** ↑ ↓ move through the city list from the input and between cities. */
  const onListKey = (event: ReactKeyboardEvent) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const buttons = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
    if (!buttons.length) return;
    event.preventDefault();
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (at === -1) (event.key === 'ArrowDown' ? buttons[0] : buttons[buttons.length - 1])!.focus();
    else if (event.key === 'ArrowUp' && at === 0) inputRef.current?.focus();
    else buttons[Math.max(0, Math.min(buttons.length - 1, at + (event.key === 'ArrowDown' ? 1 : -1)))]!.focus();
  };

  return (
    <div className={styles.locationPicker} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`btn btn-ghost ${styles.locationButton}`}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Location: ${buttonLabel(viewer)}. Change location`}
        onClick={() => {
          setQuery('');
          setOpen((value) => !value);
        }}
      >
        <span aria-hidden="true" className={styles.locationPin}>◉</span>
        <span className={styles.locationLabel}>{buttonLabel(viewer)}</span>
        <span aria-hidden="true" className={styles.locationChevron}>▾</span>
      </button>
      {open && (
        <div id={panelId} className={styles.locationPanel} role="dialog" aria-label="Choose your location" onKeyDown={onListKey}>
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
          <p className={styles.locationNote}>
            Your city is worked out on this device and never sent anywhere. City names: <a href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer" className="underline">GeoNames</a> (CC BY 4.0).
          </p>
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
            <ul className={styles.locationList} ref={listRef}>
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
