'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { ThumbsUp } from 'lucide-react';
import { useHydrated } from '@/components/designer/useHydrated';
import { useActiveProfile } from '@/lib/designer/store';
import { TONE_COLOR } from '@/lib/activity/season';
import { interestWeights, type Tone, type Weights } from '@/lib/ski/match';
import type { Level } from '@/lib/ski/share';
import { defaultWindow, useSkiPlan } from '@/lib/ski/store';
import { useSkiData, type SkiData } from '@/lib/ski/useSkiData';
import { addDays, formatSpan, isIsoDate, type TripWindow } from '@/lib/ski/window';
import { allSignals } from '@/lib/vibe/signals';
import styles from './ski.module.css';
import { useGlow } from '@/lib/voice/glow';

export interface SkiContext {
  data: SkiData;
  window: TripWindow;
  weights: Weights;
  hasProfile: boolean;
}

/** The data, the window (saved or the default) and what they like. Null until the data and the saved plan are in. */
export function useSkiContext(): SkiContext | null {
  const hydrated = useHydrated();
  const data = useSkiData();
  const saved = useSkiPlan((state) => state.window);
  const party = useSkiPlan((state) => state.party);
  const active = useActiveProfile();
  const signals = useMemo(() => (active?.profile ? allSignals(active.profile) : []), [active]);
  const weights = useMemo(() => interestWeights(signals, party), [signals, party]);
  const window = useMemo(() => saved ?? defaultWindow(new Date()), [saved]);
  if (!hydrated || !data) return null;
  return { data, window, weights, hasProfile: signals.length > 0 };
}

export const toneStyle = (tone: Tone) => ({ '--dot': TONE_COLOR[tone] }) as CSSProperties;
export const cardColors = (colors: [string, string]) => ({ '--c1': colors[0], '--c2': colors[1] }) as CSSProperties;
/** The range's map (rendered by scripts/ski/render-range-maps.mjs) behind a card, tinted with its colors. */
export const rangeMapStyle = (id: string, colors: [string, string]) => ({ ...cardColors(colors), '--map': `url(/ski/ranges/${id}.jpg)` }) as CSSProperties;

/** "resortId@2027-01-23" → "Aspen Snowmass, Jan 23 to 28". */
export function optionLabel(data: SkiData, level: Level, key: string, nights: number): { title: string; sub: string; href: string } | null {
  if (level === 'range') {
    const range = data.rangeById.get(key);
    return range ? { title: range.name, sub: range.where, href: `/ski/${range.id}` } : null;
  }
  const [id, start] = key.split('@');
  const resort = data.resortById.get(id);
  if (!resort) return null;
  if (level === 'resort') return { title: resort.name, sub: `${resort.place}, ${resort.region}`, href: `/ski/resort/${resort.id}` };
  if (!start || !isIsoDate(start)) return null;
  return { title: resort.name, sub: formatSpan(start, addDays(start, nights)), href: `/ski/resort/${resort.id}` };
}

export function ThumbButton({ on, onToggle, label, small }: { on: boolean; onToggle: () => void; label: string; small?: boolean }) {
  return (
    <button type="button" className={small ? styles.thumbSmall : styles.thumb} aria-pressed={on} aria-label={`${on ? 'Remove' : 'Add'} ${label} ${on ? 'from' : 'to'} your shortlist`} onClick={onToggle}>
      <ThumbsUp size={16} aria-hidden="true" fill={on ? 'currentColor' : 'none'} />
      {on ? 'On your list' : 'Shortlist'}
    </button>
  );
}

const NIGHTS = [3, 4, 5, 7, 10];

/** When they could go, for how long, and who's coming. */
export function WindowPicker({ window }: { window: TripWindow }) {
  const setWindow = useSkiPlan((state) => state.setWindow);
  const party = useSkiPlan((state) => state.party);
  const setParty = useSkiPlan((state) => state.setParty);
  const update = (next: Partial<TripWindow>) => {
    const merged = { ...window, ...next };
    if (!isIsoDate(merged.from) || !isIsoDate(merged.to)) return;
    if (merged.to < merged.from) merged.to = merged.from;
    setWindow(merged);
  };
  const lit = useGlow('ski:window');
  return (
    <div className={styles.when} {...lit}>
      <div className={styles.dates}>
        <label>
          Could leave from
          <input type="date" value={window.from} onChange={(event) => update({ from: event.target.value })} />
        </label>
        <label>
          Back by
          <input type="date" value={window.to} min={window.from} onChange={(event) => update({ to: event.target.value })} />
        </label>
      </div>
      <div className={styles.chips} role="group" aria-label="Nights">
        <span className={styles.chipsLabel}>Nights</span>
        {NIGHTS.map((nights) => (
          <button key={nights} type="button" className={styles.chip} aria-pressed={window.nights === nights} onClick={() => update({ nights })}>{nights}</button>
        ))}
      </div>
      <div className={styles.chips} role="group" aria-label="Who’s coming">
        <span className={styles.chipsLabel}>Who</span>
        <button type="button" className={styles.chip} aria-pressed={party === 'family'} onClick={() => setParty('family')}>Families with kids</button>
        <button type="button" className={styles.chip} aria-pressed={party === 'crew'} onClick={() => setParty('crew')}>Adults</button>
      </div>
    </div>
  );
}

/** How many picks there are, and the way to the trip. Pinned above the nav. */
export function TripBar() {
  const picks = useSkiPlan((state) => state.picks);
  const hydrated = useHydrated();
  const lit = useGlow('ski:bar');
  const count = hydrated ? picks.range.length + picks.resort.length + picks.week.length + picks.scene.length : 0;
  if (!count) return null;
  return (
    <div className={styles.bar} {...lit}>
      <span><strong>{count}</strong> on your shortlist</span>
      <Link href="/ski/trip" className={styles.primary}>Your trip</Link>
    </div>
  );
}

/** Share a link with the phone's share sheet, or copy it. Returns what happened, for a toast. */
export function useShare() {
  const [toast, setToast] = useState<string | null>(null);
  const share = useCallback(async (url: string, text: string) => {
    let message = 'Link copied';
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ text, url });
        message = 'Shared';
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`);
      }
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(`${text} ${url}`);
      } catch {
        message = 'Couldn’t copy the link';
      }
    }
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  }, []);
  const node = toast ? <div className={styles.toast} role="status">{toast}</div> : null;
  return { share, toast: node };
}

export function Loading() {
  return <div className={styles.page}><div className={styles.wrap}><div className={styles.empty}>Loading the mountains…</div></div></div>;
}

const subscribeHash = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
};

/** One value from the address's fragment (#p=…), or null before hydration. */
export function useHashParam(name: string): string | null {
  return useSyncExternalStore(
    subscribeHash,
    () => new URLSearchParams(window.location.hash.slice(1)).get(name) ?? '',
    () => null,
  );
}

/** Credit for the range maps: the basemap, its data and the terrain, each linked. Sits above the card's link. */
export function MapCredit() {
  return (
    <span className={styles.mapCredit}>
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>
      {' · '}
      <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a>
      {' · '}
      <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener noreferrer">Terrain: Mapzen</a>
    </span>
  );
}
