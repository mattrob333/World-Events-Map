'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import styles from './nearby-pulse.module.css';

/**
 * How far and what for. On a phone the two rows fold into one quiet pill
 * that says what's showing ("1 mi · Anything"); tap it to change either.
 * Wider screens show the rows as they are.
 */
export function NowFilters<W extends string>({
  radii,
  radius,
  onRadius,
  whats,
  what,
  onWhat,
}: {
  radii: readonly { miles: number; meters: number }[];
  radius: number;
  onRadius: (meters: number) => void;
  whats: readonly { value: W; label: string }[];
  what: W;
  onWhat: (value: W) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  const miles = radii.find((r) => r.meters === radius)?.miles;
  const label = whats.find((w) => w.value === what)?.label ?? '';

  return (
    <div ref={root} className={styles.controls} data-open={open || undefined}>
      <button type="button" className={styles.filterPill} aria-expanded={open} aria-controls="now-filter-rows" onClick={() => setOpen(!open)}>
        <SlidersHorizontal size={15} aria-hidden="true" />
        <span>{miles ? `${miles} mi` : 'Nearby'} · {label}</span>
        <ChevronDown size={15} aria-hidden="true" className={styles.filterChevron} />
      </button>
      <div id="now-filter-rows" className={styles.filterRows}>
        <div className={styles.chips} role="group" aria-label="How far">
          {radii.map((choice) => (
            <button key={choice.miles} type="button" className={styles.chip} aria-pressed={radius === choice.meters} onClick={() => onRadius(choice.meters)}>{choice.miles} mi</button>
          ))}
        </div>
        <div className={styles.chips} role="group" aria-label="What you’re after">
          {whats.map((choice) => (
            <button key={choice.value} type="button" className={styles.chip} aria-pressed={what === choice.value} onClick={() => onWhat(choice.value)}>{choice.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
