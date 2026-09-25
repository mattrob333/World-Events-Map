'use client';

import { useEffect, useRef } from 'react';
import { handoffNote, openTableSearch, takesTableSearch } from '@/lib/booking/partners';
import { SLOT_META, type DesignerCard, type SlotKind } from '@/lib/designer/catalog';
import { useModalFocus } from '@/components/shell/useModalFocus';
import { CardArt, type RideOffer } from './IdeaCard';
import styles from './designer.module.css';
import { SourceLogo } from '@/components/brand/SourceLogo';

const TRAVEL = new Set<SlotKind>(['depart', 'flight', 'arrive']);
const MEAL_TIME: Partial<Record<SlotKind, string>> = { lunch: '12:30', dinner: '19:30', apres: '16:30' };

function linkHost(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * One idea, opened up: the art, the whole description, where it is, and the
 * hand-offs we can honestly offer. Phone numbers, hours and bookings live on
 * the place's own listing; we link there rather than print numbers we haven't checked.
 */
export function CardDetail({ card, ride, slotKind, where, date, covers, onClose }: {
  card: DesignerCard;
  ride?: RideOffer;
  slotKind: SlotKind;
  where: string;
  date: string;
  covers: number;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useModalFocus(dialogRef);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const query = `${card.title} ${where}`.trim();
  // Getting-there ideas ("Car to the airport") aren't a place to look up.
  const onMap = !TRAVEL.has(slotKind);
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  const mealTime = MEAL_TIME[slotKind];
  const table = mealTime && takesTableSearch({ name: card.title }) ? openTableSearch({ name: card.title, where, date, time: mealTime, covers }) : null;
  // The card's own link, unless it's the same Maps search we already offer.
  const own = card.link && !card.link.href.startsWith('https://www.google.com/maps/') ? card.link : null;

  return (
    <div className={styles.detailBackdrop} onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div ref={dialogRef} className={styles.detail} role="dialog" aria-modal="true" aria-labelledby={`detail-${card.id}`}>
        <div className={styles.detailArt}>
          <CardArt card={card} />
          <button ref={closeRef} type="button" className={styles.detailClose} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className={styles.detailBody}>
          <p className={styles.detailKicker}>
            {SLOT_META[slotKind].label} · {where}
          </p>
          <h2 id={`detail-${card.id}`} className={styles.detailTitle}>
            {ride ? `Ride to ${ride.iata}` : card.title}
          </h2>
          <p className={styles.detailBlurb}>{ride ? `From where you are to ${ride.name}. The ride app fills in your pickup.` : card.blurb}</p>
          <div className={styles.detailActions}>
            {ride ? (
              <>
                <a className="btn btn-primary btn-sm" href={ride.uber} target="_blank" rel="noopener noreferrer"><SourceLogo source={ride.uber} size={14} className="mr-1.5" />Open Uber ↗</a>
                <a className="btn btn-ghost btn-sm" href={ride.lyft} target="_blank" rel="noopener noreferrer"><SourceLogo source={ride.lyft} size={14} className="mr-1.5" />Open Lyft ↗</a>
              </>
            ) : null}
            {onMap ? (
              <a className="btn btn-primary btn-sm" href={mapsHref} target="_blank" rel="noopener noreferrer">
                <SourceLogo source={mapsHref} size={14} className="mr-1.5" />See it on the map ↗
              </a>
            ) : null}
            {table ? (
              <a className="btn btn-ghost btn-sm" href={table} target="_blank" rel="noopener noreferrer">
                <SourceLogo source={'opentable'} size={14} className="mr-1.5" />Find a table on OpenTable ↗
              </a>
            ) : null}
            {own ? (
              <a className={onMap ? 'btn btn-ghost btn-sm' : 'btn btn-primary btn-sm'} href={own.href} target="_blank" rel="noopener noreferrer">
                <SourceLogo source={own.href} size={14} className="mr-1.5" />{own.label} ↗
              </a>
            ) : null}
          </div>
          <p className={styles.detailNote}>
            {ride ? 'Opens the ride app with the airport set as your drop-off; prices and times are in the app. ' : ''}
            {onMap ? 'Hours, phone number and photos are on its map listing.' : ''}
            {table ? ` ${handoffNote('opentable')}` : ''}
            {own ? ` The ${own.label.toLowerCase()} link opens ${linkHost(own.href)}.` : ''} This is an idea, not a booking: check with the place before you go.
          </p>
        </div>
      </div>
    </div>
  );
}
