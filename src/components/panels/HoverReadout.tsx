'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CategoryGlyph, DURATION, EASE_GLIDE, cn, formatDateRange } from '@/components/ui';
import { PlaceGallery } from '@/components/place-media/PlaceGallery';
import { useEventById } from '@/lib/selectors';
import { useGlobeStore } from '@/lib/stores/useGlobeStore';
import styles from './hover-readout.module.css';

const OFFSET = 18;
const CARD_W = 350;
const HIDE_DELAY = 350;

export interface HoverReadoutProps { className?: string }

/** A stable, interactive preview that bridges the pointer gap from a globe marker. */
export function HoverReadout({ className }: HoverReadoutProps) {
  const hoveredEventId = useGlobeStore((s) => s.hoveredEventId);
  const selectedEventId = useGlobeStore((s) => s.selectedEventId);
  const select = useGlobeStore((s) => s.select);
  const flyTo = useGlobeStore((s) => s.flyTo);
  const [shownId, setShownId] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [overSurface, setOverSurface] = useState(false);
  const overCard = useRef(false);
  const dismissedId = useRef<string | null>(null);
  const latchedId = useRef<string | null>(null);
  const cursor = useRef<{ x: number; y: number } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = useReducedMotion();
  const event = useEventById(shownId);

  const cancelHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = null;
  };
  const scheduleHide = () => {
    cancelHide();
    hideTimer.current = setTimeout(() => {
      latchedId.current = null;
      setShownId(null);
    }, HIDE_DELAY);
  };

  useEffect(() => {
    if (hoveredEventId) {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = null;
      if (hoveredEventId !== dismissedId.current && hoveredEventId !== selectedEventId && latchedId.current !== hoveredEventId) {
        latchedId.current = hoveredEventId;
        setShownId(hoveredEventId);
        setAnchor(cursor.current);
      }
    } else {
      dismissedId.current = null;
      if (!overCard.current) {
        hideTimer.current = setTimeout(() => {
          latchedId.current = null;
          setShownId(null);
        }, HIDE_DELAY);
      }
    }
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [hoveredEventId, selectedEventId]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      cursor.current = { x: e.clientX, y: e.clientY };
      const target = e.target as Element | null;
      if (target?.closest?.('[data-meridian-hover-card]')) return;
      setOverSurface(Boolean(target?.closest?.('[data-meridian-surface]')));
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const id = useGlobeStore.getState().hoveredEventId;
      dismissedId.current = id;
      latchedId.current = null;
      setShownId(null);
      overCard.current = false;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const visible = Boolean(event && anchor && !overSurface && shownId !== selectedEventId);
  const vw = typeof window === 'undefined' ? 1200 : window.innerWidth;
  const vh = typeof window === 'undefined' ? 800 : window.innerHeight;
  const width = Math.min(CARD_W, vw - 24);
  const left = anchor ? Math.max(12, Math.min(anchor.x + OFFSET + width > vw ? anchor.x - OFFSET - width : anchor.x + OFFSET, vw - width - 12)) : 12;
  const top = anchor ? Math.max(12, Math.min(anchor.y + OFFSET, vh - Math.min(475, vh * .78) - 12)) : 12;

  const openEvent = () => {
    if (!event) return;
    cancelHide();
    select(event.id);
    flyTo(event.coords);
    setShownId(null);
  };

  return (
    <AnimatePresence>
      {visible && event && (
        <motion.div
          key={event.id}
          role="region"
          aria-label={`Preview of ${event.name}`}
          data-meridian-hover-card
          className={cn('glass-deep fixed z-50 rounded-[3px]', styles.card, className)}
          style={{ left, top, width }}
          onPointerEnter={() => { cancelHide(); overCard.current = true; setOverSurface(false); }}
          onPointerLeave={() => { overCard.current = false; scheduleHide(); }}
          initial={{ opacity: 0, y: reduced ? 0 : 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : DURATION.instant, ease: EASE_GLIDE }}
        >
          <div className={styles.gallery}><PlaceGallery event={event} compact /></div>
          <div className={styles.body}>
            <div className={styles.kicker}><CategoryGlyph category={event.category} size={12} className="text-brass" /> <span>{event.category.toUpperCase()} · {event.city.toUpperCase()}</span></div>
            <h3>{event.name}</h3>
            <p>{event.city}, {event.country} <span>·</span> {formatDateRange(event.start, event.end)}</p>
            <button type="button" onClick={openEvent}>Explore {event.city} <span aria-hidden="true">↗</span></button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
