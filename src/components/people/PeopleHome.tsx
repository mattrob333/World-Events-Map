'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useHydrated } from '@/components/designer/useHydrated';
import { profileLabel, useActiveProfile, useDesignerStore } from '@/lib/designer/store';
import { cardFromProfile, cardUrl, commonGround, type TravelCard } from '@/lib/people/card';
import { usePeopleStore } from '@/lib/people/store';
import { useVoiceStore } from '@/lib/voice/registry';
import { TravelCardView } from './TravelCardView';
import styles from './people.module.css';

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]!.toUpperCase()).join('') || '✦';

/**
 * Your people: the ones you travel with. Your own travel card to send them,
 * the cards they sent you (with what you have in common), and the crew on
 * the trip you're planning. Everything here stays on this device.
 */
export function PeopleHome() {
  const hydrated = useHydrated();
  const active = useActiveProfile();
  const trip = useDesignerStore((state) => state.trip);
  const people = usePeopleStore((state) => state.people);
  const removePerson = usePeopleStore((state) => state.removePerson);
  const openVibe = useVoiceStore((state) => state.setOpen);
  const [status, setStatus] = useState('');

  const mine: TravelCard | null = useMemo(() => (active ? cardFromProfile(active.profile, profileLabel(active)) : null), [active]);
  const crew = (trip?.participants ?? []).filter((person) => person.kind !== 'kid').slice(1);

  async function send() {
    if (!mine) return;
    const url = cardUrl(window.location.origin, { ...mine, sentAt: new Date().toISOString() });
    setStatus('');
    try {
      if (navigator.share) {
        await navigator.share({ title: `${mine.name}’s travel card`, text: 'My travel card: what I love and how I like to travel.', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setStatus('Link copied. Send it to the people you travel with.');
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setStatus('Couldn’t share from this browser. Copy the address after opening your card instead.');
    }
  }

  return (
    <main className={styles.page}>
      <p className={styles.kicker}>People</p>
      <h1 className="mt-3 font-display text-5xl text-ink">Your people</h1>
      <p className={styles.lede}>The ones you travel with. Send them your travel card, save theirs, and see what you have in common before anyone books anything.</p>

      <section className={styles.section} aria-labelledby="my-card">
        <div className={styles.sectionHead}>
          <h2 id="my-card">Your travel card</h2>
        </div>
        {!hydrated ? null : mine ? (
          <>
            <TravelCardView card={mine} />
            <div className={styles.actions}>
              <button type="button" className="btn btn-primary" onClick={() => void send()}>Send your travel card <span aria-hidden="true">↗</span></button>
              <Link href="/vibe" className="btn btn-ghost">Edit your profile</Link>
            </div>
            {status ? <p role="status" className="notice mt-3 max-w-xl text-[13px]">{status}</p> : null}
            <p className={styles.note}>
              The card carries your name, home city, what you love, your music, teams and travel style. Never your family’s names or ages. It travels inside the link, so dope.travel never sees who you send it to, and anyone with the link can read it.
            </p>
          </>
        ) : (
          <div className={styles.empty}>
            Your card is built from your traveler profile, and you don’t have one yet.
            <div className={styles.actions}>
              <button type="button" className="btn btn-primary" onClick={() => openVibe(true)}>Set your vibe</button>
            </div>
          </div>
        )}
      </section>

      <section className={styles.section} aria-labelledby="saved-people">
        <div className={styles.sectionHead}>
          <h2 id="saved-people">Cards you’ve saved</h2>
        </div>
        {!hydrated ? null : people.length ? (
          <ul className={styles.grid}>
            {people.map(({ id, card }) => {
              const shared = mine ? commonGround(mine, card) : [];
              return (
                <li key={id} className={styles.person}>
                  <div className={styles.personTop}>
                    <span className={styles.monogram} aria-hidden="true">{initials(card.name)}</span>
                    <div className="min-w-0">
                      <p className={styles.personName}>{card.name}</p>
                      <p className={styles.personMeta}>{card.hometown ? `From ${card.hometown}` : 'Home city not shared'}</p>
                    </div>
                  </div>
                  {shared.length ? (
                    <p className={styles.chips} aria-label="What you have in common">
                      {shared.map((value) => <span key={value} className={`${styles.chip} ${styles.chipShared}`}>{value}</span>)}
                    </p>
                  ) : (
                    <p className={styles.personMeta}>{[...card.loves, ...card.music].slice(0, 4).join(' · ') || 'No tastes on the card yet'}</p>
                  )}
                  <div className={styles.personActions}>
                    <Link href="/trips/new" className="btn btn-ghost btn-sm">Plan a trip together</Link>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => removePerson(id)} aria-label={`Remove ${card.name}`}>Remove</button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={styles.empty}>When someone sends you their travel card, open the link and save it. It shows up here, with what you have in common.</p>
        )}
      </section>

      {hydrated && crew.length ? (
        <section className={styles.section} aria-labelledby="trip-crew">
          <div className={styles.sectionHead}>
            <h2 id="trip-crew">On your trip</h2>
          </div>
          <p className={styles.lede}>
            {crew.map((person) => person.name).join(', ')} {crew.length === 1 ? 'is' : 'are'} on the trip you’re planning. Send them your card so their picks start from what you both love.
          </p>
          <div className={styles.actions}>
            <Link href="/trips" className="btn btn-ghost">Open your trip</Link>
          </div>
        </section>
      ) : null}
    </main>
  );
}
