'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { profileLabel, useActiveProfile } from '@/lib/designer/store';
import { cardFromProfile, commonGround, decodeCard, type TravelCard } from '@/lib/people/card';
import { usePeopleStore } from '@/lib/people/store';
import { TravelCardView } from './TravelCardView';
import styles from './people.module.css';

const andList = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

/**
 * Opens a travel card someone sent (`/people/card#c=…`). The card is read
 * from the link fragment in the browser; nothing about it reaches a server.
 */
export function CardReceive() {
  const [card, setCard] = useState<TravelCard | null | 'none'>(null);
  const [saved, setSaved] = useState(false);
  const active = useActiveProfile();
  const savePerson = usePeopleStore((state) => state.savePerson);

  useEffect(() => {
    const read = () => {
      const encoded = new URLSearchParams(window.location.hash.slice(1)).get('c') ?? '';
      setCard(decodeCard(encoded) ?? 'none');
    };
    const timer = window.setTimeout(read, 0);
    window.addEventListener('hashchange', read);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('hashchange', read);
    };
  }, []);

  const shared = useMemo(() => (card && card !== 'none' && active ? commonGround(cardFromProfile(active.profile, profileLabel(active)), card) : []), [active, card]);

  if (card === null) return <main className={styles.page} />;
  if (card === 'none') {
    return (
      <main className={styles.page}>
        <p className={styles.kicker}>Travel card</p>
        <h1 className="mt-3 font-display text-4xl text-ink">This card link didn’t come through whole.</h1>
        <p className={styles.lede}>Ask them to send it again. Links sometimes get cut off when they’re pasted.</p>
        <div className={styles.actions}><Link href="/people" className="btn btn-ghost">Your people</Link></div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <p className={styles.kicker}>A travel card for you</p>
      <h1 className="mt-3 font-display text-4xl text-ink">{card.name} wants to travel with you.</h1>
      {shared.length ? (
        <p className={styles.lede}>You both love {andList(shared.slice(0, 3))}. That’s a trip right there.</p>
      ) : (
        <p className={styles.lede}>{active ? 'No overlap yet on your cards. New ground is half the fun.' : 'Set your own vibe to see what you have in common.'}</p>
      )}
      <div className="mt-6">
        <TravelCardView card={card} shared={shared} />
      </div>
      <div className={styles.actions}>
        {saved ? (
          <Link href="/people" className="btn btn-primary">Saved. See your people <span aria-hidden="true">↗</span></Link>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => { savePerson(card); setSaved(true); }}>Save to your people</button>
        )}
        <Link href="/trips/new" className="btn btn-ghost">Plan a trip together</Link>
      </div>
      <p className={styles.note}>Saved cards stay on this device. This card came inside the link; dope.travel didn’t store it.</p>
    </main>
  );
}
