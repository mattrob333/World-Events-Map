'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { SLOT_META, type DesignerCard, type DesignerDestination } from '@/lib/designer/catalog';
import type { Itinerary, Participant, Slot } from '@/lib/designer/itinerary';
import { partyFrom, staySearches } from '@/lib/designer/stays';
import { tripMoment } from '@/lib/designer/tripNow';
import { replyFor, replyLink, tripLink } from '@/lib/designer/tripShare';
import type { TripVotes } from '@/lib/designer/votes';
import styles from './designer.module.css';

/** Ticks once a minute so "right now" stays right. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function Pick({ slot, lookup, label }: { slot: Slot; lookup: (id: string) => DesignerCard | undefined; label: string }) {
  const card = lookup(slot.cardIds[0]);
  const body = (
    <>
      <span className={styles.nowPickEmoji} style={{ ['--a' as string]: card?.palette[0] ?? '#f26b2a', ['--b' as string]: card?.palette[1] ?? '#8e4db8' }} aria-hidden>
        {card?.emoji ?? SLOT_META[slot.kind].emoji}
      </span>
      <span className="min-w-0">
        <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
          {label} · {slot.label}
        </span>
        <span className="block text-[15px] font-semibold text-ink">{card?.title ?? 'Free time'}</span>
        {card?.link ? <span className="block text-[12px] text-ink-muted">{card.link.label} ↗</span> : null}
      </span>
    </>
  );
  return card?.link ? (
    <a className={styles.nowPick} href={card.link.href} target="_blank" rel="noopener noreferrer">
      {body}
    </a>
  ) : (
    <div className={styles.nowPick}>{body}</div>
  );
}

/** Shows today's plan when the trip is underway, plus a jump to NOW for something nearby. */
export function RightNow({ trip, destination, lookup, now, nowLink = true }: { trip: Itinerary; destination: DesignerDestination; lookup: (id: string) => DesignerCard | undefined; now: Date; nowLink?: boolean }) {
  const moment = tripMoment(trip, now);
  if (!moment) return null;
  const { day, current, next } = moment;
  const city = destination.id === 'maldives' ? 'Male' : destination.name;
  return (
    <section className={styles.nowCard} aria-labelledby="trip-now-title">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#f7c548]">
        <span className={styles.nowPulse} aria-hidden />
        Day {day.index + 1} of {trip.days.length} · you’re here
      </p>
      <h2 id="trip-now-title" className="mt-1 font-display text-[28px] leading-tight text-ink">
        {current || next ? 'Right now in ' : 'Tonight in '}
        {destination.name}
      </h2>
      {current ? <Pick slot={current} lookup={lookup} label="Now" /> : null}
      {next ? <Pick slot={next} lookup={lookup} label="Up next" /> : null}
      {nowLink ? (
        <div className={`${styles.row} mt-3`}>
          <Link className={styles.cta} href={`/now?city=${encodeURIComponent(city)}`}>
            Something else nearby, right now →
          </Link>
        </div>
      ) : null}
    </section>
  );
}

export function StaysPanel({ trip, destination }: { trip: Itinerary; destination: DesignerDestination }) {
  const party = partyFrom(trip.participants);
  const place = [destination.name, destination.region].filter(Boolean).join(', ');
  const searches = staySearches({ place, checkIn: trip.startDate, nights: trip.nights, party });
  const guests = `${party.adults} adult${party.adults === 1 ? '' : 's'}${party.kids ? `, ${party.kids} kid${party.kids === 1 ? '' : 's'}` : ''}`;
  return (
    <section className={styles.panel} aria-labelledby="stays-title">
      <p id="stays-title" className={styles.factTitle}>
        Where you’ll stay
      </p>
      <p className="mt-1 text-[13px] text-ink-muted">
        {guests} · {trip.nights} night{trip.nights === 1 ? '' : 's'} from {trip.startDate}. Each opens that site’s live search with your dates and party filled in.
      </p>
      <div className={styles.stayGrid}>
        {searches.map((search) => (
          <a key={search.id} className={styles.stayLink} href={search.href} target="_blank" rel="noopener noreferrer">
            <span className={styles.stayName}>{search.label} ↗</span>
            <span className="text-[12px] text-ink-muted">{search.note}</span>
          </a>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-4 text-ink-faint">Search links, not listings: prices and availability are on each site. Check guest counts and kids’ ages there before you book.</p>
    </section>
  );
}

async function shareOrCopy(url: string, title: string, text: string): Promise<'shared' | 'copied' | 'shown'> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return 'shown';
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'shown';
  }
}

/** Invite friends with a link; on a friend's copy, send their picks back. */
export function InvitePanel({ trip, votes, voter, destination }: { trip: Itinerary; votes: TripVotes; voter?: Participant; destination: DesignerDestination }) {
  const [link, setLink] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const guest = trip.joinedFrom !== undefined;
  // The placeholder name "You" would read as “You wants you on this trip” to a friend.
  const organizer = useMemo(() => {
    const name = trip.participants[0]?.name;
    return name && !/^you$/i.test(name) ? name : undefined;
  }, [trip.participants]);

  async function invite() {
    setError('');
    try {
      const url = await tripLink(window.location.origin, trip, votes, organizer);
      setLink(url);
      const result = await shareOrCopy(url, `${destination.name} trip`, `Help plan our ${destination.name} trip: tap ♥ on what you’re into.`);
      setStatus(result === 'copied' ? 'Link copied. Paste it in the group chat.' : result === 'shared' ? 'Sent.' : 'Copy the link below.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not build the link.');
    }
  }

  async function sendPicks() {
    setError('');
    if (!voter) return;
    try {
      const url = await replyLink(window.location.origin, replyFor(trip, votes, voter.id));
      setLink(url);
      const result = await shareOrCopy(url, `${voter.name}’s picks`, `My picks for ${destination.name}. Tap to add them to the trip.`);
      setStatus(result === 'copied' ? `Link copied. Send it to ${trip.joinedFrom || 'the organizer'}.` : result === 'shared' ? 'Sent.' : 'Copy the link below.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not build the link.');
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="invite-title">
      <p id="invite-title" className={styles.factTitle}>
        {guest ? `You’re on ${trip.joinedFrom ? `${trip.joinedFrom}’s` : 'this'} trip` : 'Bring the crew'}
      </p>
      <p className="mt-1 text-[13px] leading-5 text-ink-muted">
        {guest
          ? `Vote as ${voter?.name ?? 'yourself'}, then send your picks back. They merge into the organizer’s plan.`
          : 'The whole trip travels inside the link, so there’s no sign-up. Friends vote on their own phone and send their picks back with one tap.'}
      </p>
      <div className={`${styles.row} mt-3`}>
        {guest ? (
          <button type="button" className={styles.cta} onClick={sendPicks} disabled={!voter}>
            Send my picks back
          </button>
        ) : null}
        <button type="button" className={guest ? styles.ghost : styles.cta} onClick={invite}>
          {guest ? 'Share the trip' : 'Invite people'}
        </button>
      </div>
      {status ? <p className="mt-2 text-[12px] text-ink-muted" role="status">{status}</p> : null}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {link ? (
        <textarea className={styles.shareBox} readOnly rows={3} value={link} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} />
      ) : null}
      <p className="mt-2 text-[11px] leading-4 text-ink-faint">
        Anyone with the link can see the plan and who’s going (names, kids’ ages, home city). Music taste stays on your device. Picks sync when a link is opened, not live.
      </p>
    </section>
  );
}
