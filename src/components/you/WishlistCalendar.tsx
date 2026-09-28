'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Heart } from 'lucide-react';
import { byId } from '@/lib/activity/activities';
import { useActivities } from '@/lib/activity/useActivities';
import { wishlistRows, windowMonths, type SavedEvent, type WishRow } from '@/lib/activity/wishlist';
import { useIntentStore } from '@/lib/intent/store';
import styles from './wishlist.module.css';

const noopSubscribe = () => () => {};

/** Calendar events the traveler saved, loaded only when there are some. */
function useSavedEventIndex(enabled: boolean): ReadonlyMap<string, SavedEvent> | null {
  const [index, setIndex] = useState<ReadonlyMap<string, SavedEvent> | null>(null);
  useEffect(() => {
    if (!enabled || index) return;
    let live = true;
    void import('@/lib/data/events').then((m) => {
      if (live) setIndex(m.EVENT_INDEX as ReadonlyMap<string, SavedEvent>);
    });
    return () => {
      live = false;
    };
  }, [enabled, index]);
  return index;
}

const EMPTY_EVENTS: ReadonlyMap<string, SavedEvent> = new Map();

/**
 * Your wish list as a year: every place you've hearted on the globe (and
 * every event you saved), on one calendar that starts this month, with the
 * months each one is at its best. Soonest first. It lives on this device,
 * like the saves it's built from.
 */
export function WishlistCalendar({ hideWhenEmpty = false }: { hideWhenEmpty?: boolean }) {
  const client = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const items = useIntentStore((s) => s.items);
  const saves = useMemo(() => items.filter((i) => i.verb === 'save' && (i.kind === 'spot' || i.kind === 'event')), [items]);
  const activities = useActivities(saves.some((i) => i.kind === 'spot'));
  const events = useSavedEventIndex(saves.some((i) => i.kind === 'event'));
  const now = useMemo(() => new Date(), []);
  const rows = useMemo(
    () => wishlistRows(saves, byId(activities ?? []), events ?? EMPTY_EVENTS, now),
    [saves, activities, events, now],
  );
  const months = useMemo(() => windowMonths(now), [now]);
  const todayAt = (now.getDate() - 1) / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const goodNow = rows.filter((r) => r.soon === 0).length;

  if (!client || (hideWhenEmpty && !saves.length)) return null;

  return (
    <section id="wish-list" className={styles.shell} aria-labelledby="wish-list-title">
      <div className={styles.head}>
        <p className={styles.kicker}><Heart size={12} fill="currentColor" aria-hidden="true" /> YOUR WISH LIST</p>
        <h2 id="wish-list-title" className={styles.title}>When to go</h2>
        <p className={styles.summary}>
          {rows.length
            ? `${rows.length} ${rows.length === 1 ? 'place' : 'places'}${goodNow ? `, ${goodNow} good right now` : ''}. Brighter months are the best time.`
            : 'Heart places on the globe and they land here, laid out by the best time to go.'}
        </p>
      </div>

      {rows.length ? (
        <div className={styles.table}>
          <div className={styles.row} aria-hidden="true">
            <span className={styles.nameHead}>Place</span>
            <div className={styles.months}>
              {months.map((m, i) => (
                <span key={i} className={styles.month} data-now={i === 0 || undefined}>
                  {m.year ? <em>{String(m.year).slice(2)}</em> : null}
                  {m.label.slice(0, 1)}
                </span>
              ))}
            </div>
          </div>
          <ol className={styles.list}>
            {rows.map((row, r) => (
              <li key={row.key}>
                <WishRowView row={row} todayAt={todayAt} index={r} />
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <Link href="/#world-map" className={styles.empty}>
          <span className={styles.emptyGlobe} aria-hidden="true" />
          <span>
            <strong>Start exploring the globe</strong>
            <span>Tap a spot, then the heart.</span>
          </span>
        </Link>
      )}
    </section>
  );
}

function WishRowView({ row, todayAt, index }: { row: WishRow; todayAt: number; index: number }) {
  return (
    <Link href={row.href} className={styles.row} style={{ ['--c' as string]: row.color, ['--i' as string]: index }} aria-label={`${row.name}, ${row.place}. ${row.detail ?? row.when}`}>
      <span className={styles.name}>
        <span className={styles.dot} aria-hidden="true" />
        <span className={styles.nameText}>
          <strong>{row.name}</strong>
          <small>{row.when}</small>
        </span>
      </span>
      <div className={styles.months} aria-hidden="true">
        {row.months
          ? row.months.map((state, i) => <span key={i} className={styles.cell} data-state={state} />)
          : Array.from({ length: 12 }, (_, i) => <span key={i} className={styles.cell} data-state="off" />)}
        {row.span ? (
          <span className={styles.span} style={{ left: `${(row.span.from / 12) * 100}%`, width: `${((row.span.to - row.span.from) / 12) * 100}%` }} />
        ) : null}
        <span className={styles.today} style={{ left: `${(todayAt / 12) * 100}%` }} aria-hidden="true" />
      </div>
    </Link>
  );
}
