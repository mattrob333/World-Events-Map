'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { Activity } from '@/lib/activity/activities';
import { useActivityStore, type SheetSnap } from '@/lib/activity/store';
import { useGlobeStore } from '@/lib/stores/useGlobeStore';
import { ActivityCard, snapHeights, tabBarHeight, PANEL_WIDTH, PANEL_GAP } from './ActivityCard';
import { ActivityFilters } from './ActivityFilters';
import styles from './spot.module.css';

/**
 * Mirror the open spot in the address bar, without a navigation. The state is
 * null on purpose: Next syncs its router (and useSearchParams) from a
 * replaceState it didn't make only when the state isn't its own, so the
 * page's other URL writes keep the spot.
 */
export function writeSpotParam(id: string | null) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set('spot', id);
  else url.searchParams.delete('spot');
  if (url.href !== window.location.href) window.history.replaceState(null, '', url);
}

const noopSubscribe = () => () => {};

/**
 * How far to shift the rendered globe so the spot sits in the middle of what
 * the card leaves open: above a bottom sheet, left of the side panel.
 */
function offsetFor(snap: SheetSnap | null, globe: DOMRect, filtersBottom: number): { x: number; y: number } {
  if (!snap) return { x: 0, y: 0 };
  if (snap === 'panel') {
    const right = Math.min(globe.right, window.innerWidth - PANEL_WIDTH - PANEL_GAP * 2);
    return { x: Math.round((globe.left + globe.right) / 2 - (globe.left + right) / 2), y: 0 };
  }
  const cardTop = window.innerHeight - snapHeights()[snap] - tabBarHeight();
  const top = Math.max(globe.top, filtersBottom);
  const bottom = Math.min(globe.bottom, cardTop);
  if (bottom - top < 80) return { x: 0, y: 0 };
  return { x: 0, y: Math.round((globe.top + globe.bottom) / 2 - (top + bottom) / 2) };
}

/**
 * Everything the activity layer puts over the globe: the month and kind
 * filters on top, and the one open card. Render inside the globe's box.
 */
export function ActivityOverlay({ activities }: { activities: Activity[] }) {
  const root = useRef<HTMLDivElement>(null);
  const filters = useRef<HTMLDivElement>(null);
  const snap = useActivityStore((s) => s.snap);
  // The card portals to <body>, which only exists in the browser.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  // On wide screens the page keeps columns over the globe's edges (a heading
  // on the left, a ranked list on the right, marked data-dock-avoid). The
  // filters take the open band between them.
  const [dock, setDock] = useState<{ left: number; right: number } | null>(null);
  useEffect(() => {
    const el = root.current;
    const section = el?.closest('section');
    if (!el || !section) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      let left = 0;
      let right = 0;
      if (window.innerWidth >= 1024) {
        for (const node of section.querySelectorAll<HTMLElement>('[data-dock-avoid]')) {
          const r = node.getBoundingClientRect();
          if (!r.width || r.top > box.top + 140) continue;
          if (node.dataset.dockAvoid === 'left') left = Math.max(left, r.right - box.left + 12);
          else right = Math.max(right, box.right - r.left + 12);
        }
      }
      setDock((d) => (d && d.left === left && d.right === right ? d : { left, right }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(section);
    for (const node of section.querySelectorAll('[data-dock-avoid]')) observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Keep the spot in view as the card changes height or the window resizes.
  useEffect(() => {
    const update = () => {
      const box = root.current?.getBoundingClientRect();
      if (!box) return;
      const o = offsetFor(snap, box, filters.current?.getBoundingClientRect().bottom ?? box.top);
      useGlobeStore.getState().setViewOffset(o.x, o.y);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [snap]);

  // Leaving the globe puts it back where it was, and the link stops naming a spot.
  useEffect(() => () => {
    useGlobeStore.getState().setViewOffset(0, 0);
    const { selectedId, pendingId, closeCard } = useActivityStore.getState();
    if (selectedId || pendingId) writeSpotParam(null);
    closeCard();
  }, []);

  return (
    <div ref={root} className={styles.stage}>
      <div ref={filters} className={styles.filtersDock} style={dock ? { left: dock.left, right: dock.right } : undefined}>
        <ActivityFilters activities={activities} />
      </div>
      {mounted ? createPortal(<ActivityCard activities={activities} />, document.body) : null}
    </div>
  );
}

/**
 * Open the card a `?spot=` link names, once the globe has finished its
 * opening move. Unknown ids are ignored.
 */
export function useSpotDeepLink(activities: Activity[], spot: string | null) {
  const ready = useGlobeStore((s) => s.ready);
  const done = useRef<string | null>(null);
  const known = Boolean(spot && activities.some((a) => a.id === spot));

  // The globe only wakes up on screen: bring it there for a link.
  useEffect(() => {
    if (!known) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('world-map')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }, [known]);

  useEffect(() => {
    if (!spot) {
      done.current = null;
      return;
    }
    if (!ready || !known || done.current === spot) return;
    done.current = spot;
    // Our own address-bar write after a tap: that card is already open or on its way.
    const { selectedId, pendingId, requestSelect } = useActivityStore.getState();
    if (selectedId === spot || pendingId === spot) return;
    requestSelect(spot);
  }, [ready, spot, known]);
}
