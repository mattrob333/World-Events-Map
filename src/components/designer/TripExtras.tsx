'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { SLOT_META, type DesignerCard, type DesignerDestination } from '@/lib/designer/catalog';
import type { Itinerary, Participant, Slot } from '@/lib/designer/itinerary';
import { partyFrom, staySearches } from '@/lib/designer/stays';
import { originAirport } from '@/lib/designer/airports';
import { isLive, mapsNearYou, tripMoment } from '@/lib/designer/tripNow';
import { clearDeviceData } from '@/lib/designer/deviceData';
import { useDesignerStore } from '@/lib/designer/store';
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

const TRAVEL_SLOTS = new Set(['depart', 'flight', 'arrive']);

function Pick({ slot, lookup, label, until, near }: { slot: Slot; lookup: (id: string) => DesignerCard | undefined; label: string; until?: string; near?: { name: string; region?: string } }) {
  const card = lookup(slot.cardIds[0]);
  // From "Right now", a Maps link searches around the phone (the city is left out; the app sends no location).
  const link = card?.link ? ((near && mapsNearYou(card.link.href, near)) ?? card.link) : undefined;
  const travel = TRAVEL_SLOTS.has(slot.kind);
  const body = (
    <>
      <span className={styles.nowPickEmoji} style={{ ['--a' as string]: card?.palette[0] ?? '#f26b2a', ['--b' as string]: card?.palette[1] ?? '#8e4db8' }} aria-hidden>
        {card?.emoji ?? SLOT_META[slot.kind].emoji}
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-brass">
          {label} · {slot.label}
          {until ? ` · until ${until}` : ''}
        </span>
        <span className="block text-[15px] font-semibold text-ink">{card?.title ?? (travel ? slot.label : 'Free time')}</span>
        {travel && slot.note ? <span className="block text-[12px] text-ink-muted">{slot.note}</span> : null}
        {link ? <span className="block text-[12px] text-ink-muted">{link.label} ↗</span> : null}
      </span>
    </>
  );
  return link ? (
    <a className={styles.nowPick} href={link.href} target="_blank" rel="noopener noreferrer">
      {body}
    </a>
  ) : (
    <div className={styles.nowPick}>{body}</div>
  );
}

/**
 * Today's plan while the trip is on: a travel-day card until arrival, the
 * current and next pick on the ground, and the airport run on the last day.
 * Nothing before the trip or after it (the hero covers those).
 */
export function RightNow({ trip, destination, lookup, now, nowLink = true }: { trip: Itinerary; destination: DesignerDestination; lookup: (id: string) => DesignerCard | undefined; now: Date; nowLink?: boolean }) {
  const moment = tripMoment(trip, now);
  if (!isLive(moment)) return null;
  const { day, current, next, phase, until } = moment;
  const city = destination.id === 'maldives' ? 'Male' : destination.name;
  const from = originAirport(trip.hometown);
  const onGround = phase === 'on-ground';
  const near = onGround ? { name: destination.name, region: destination.region } : undefined;
  const eyebrow = phase === 'travel-out' ? 'travel day' : phase === 'travel-home' ? 'heading home' : 'you’re here';
  const heading =
    phase === 'travel-out'
      ? `Travel day · ${from ? `${from} → ` : 'to '}${destination.name}`
      : phase === 'travel-home'
        ? `Heading home from ${destination.name}`
        : `${current || next ? 'Right now in ' : 'Tonight in '}${destination.name}`;
  return (
    <section className={styles.nowCard} aria-labelledby="trip-now-title">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-saffron">
        <span className={styles.nowPulse} aria-hidden />
        Day {day.index + 1} of {trip.days.length} · {eyebrow}
      </p>
      <h2 id="trip-now-title" className="mt-1 font-display text-[28px] leading-tight text-ink">
        {heading}
      </h2>
      {current ? <Pick slot={current} lookup={lookup} label="Now" until={until} near={near} /> : null}
      {next ? <Pick slot={next} lookup={lookup} label="Up next" near={near} /> : null}
      {nowLink && onGround ? (
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
      <p className="mt-2 text-[11px] leading-4 text-ink-subtle">Search links, not listings: prices and availability are on each site. Check guest counts and kids’ ages there before you book.</p>
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

/** Sends this guest's own picks back to the organizer (shared by the guest bar and the invite panel). */
export type PicksSender = { send: () => Promise<void>; status: string; error: string; link: string; count: number; me?: Participant; to: string };

export function usePicksSender(trip: Itinerary, votes: TripVotes, me: Participant | undefined, destination: DesignerDestination): PicksSender {
  const [link, setLink] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const to = trip.joinedFrom || 'the organizer';
  const count = useMemo(() => {
    if (!me) return 0;
    let n = 0;
    for (const slot of Object.values(votes)) for (const card of Object.values(slot)) if (Object.hasOwn(card, me.id)) n += 1;
    return n;
  }, [votes, me]);

  async function send() {
    setError('');
    if (!me) return;
    try {
      const url = await replyLink(window.location.origin, replyFor(trip, votes, me.id));
      setLink(url);
      const result = await shareOrCopy(url, `${me.name}’s picks`, `My picks for ${destination.name}. Tap to add them to the trip.`);
      setStatus(result === 'copied' ? `Link copied. Send it to ${to}.` : result === 'shared' ? 'Sent. Vote more and send again anytime.' : 'Copy the picks link at the bottom of the page.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not build the link.');
    }
  }

  return { send, status, error, link, count, me, to };
}

/**
 * On a guest copy: who you are, how many picks you've made, and the one action
 * that gets them to the organizer. Pinned above the phone tab bar (h-16 + safe
 * area); a compact sticky bar on desktop.
 */
export function GuestBar({ picks }: { picks: PicksSender }) {
  const { me, to, count, status, error } = picks;
  if (!me) return null;
  return (
    <div
      className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 md:sticky md:inset-x-auto md:bottom-4 md:mx-auto md:mt-6 md:max-w-2xl"
      role="region"
      aria-label="Your picks"
    >
      <div className="surface-raised flex items-center gap-3 px-3 py-2">
        <span className={styles.avatar} style={{ background: me.color }} aria-hidden>
          {me.emoji}
        </span>
        <p className="min-w-0 flex-1 text-[13px] leading-5 text-ink">
          <span className="block truncate">You’re {me.name} on {to === 'the organizer' ? 'this' : `${to}’s`} trip</span>
          <span className={`block truncate text-[12px] ${error ? 'text-flamingo' : 'text-ink-muted'}`} role="status">
            {count} pick{count === 1 ? '' : 's'} · {error || status || (count ? 'not sent yet' : 'tap 👍 on what you’re into')}
          </span>
        </p>
        <button type="button" className={`${styles.cta} shrink-0`} onClick={() => void picks.send()}>
          Send to {to === 'the organizer' ? 'organizer' : to}
        </button>
      </div>
    </div>
  );
}

/** Invite friends with a link; on a friend's copy, send their picks back. */
export function InvitePanel({ trip, votes, voter, destination, picks }: { trip: Itinerary; votes: TripVotes; voter?: Participant; destination: DesignerDestination; picks?: PicksSender }) {
  const renameParticipant = useDesignerStore((state) => state.renameParticipant);
  const clearAll = useDesignerStore((state) => state.clearAll);
  const [link, setLink] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [naming, setNaming] = useState(false);
  const [hostName, setHostName] = useState('');
  const [clearing, setClearing] = useState(false);
  const guest = trip.joinedFrom !== undefined;
  const ownSender = usePicksSender(trip, votes, voter, destination);
  const sender = picks ?? ownSender;
  const host = trip.participants[0];
  // The placeholder name "You" would read as “You wants you on this trip” to a friend: ask first.
  const placeholder = !guest && Boolean(host) && /^you$/i.test(host.name.trim());

  async function invite(forTrip: Itinerary = trip) {
    setError('');
    const name = forTrip.participants[0]?.name;
    if (!guest && name && /^you$/i.test(name.trim())) {
      setNaming(true);
      return;
    }
    try {
      const url = await tripLink(window.location.origin, forTrip, votes, guest ? trip.joinedFrom || undefined : name);
      setLink(url);
      const result = await shareOrCopy(url, `${destination.name} trip`, `Help plan our ${destination.name} trip: tap ♥ on what you’re into.`);
      setStatus(result === 'copied' ? 'Link copied. Paste it in the group chat.' : result === 'shared' ? 'Sent.' : 'Copy the link below.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not build the link.');
    }
  }

  function saveName() {
    const name = hostName.trim().slice(0, 30);
    if (!name || /^you$/i.test(name) || !host) {
      setError('Type the name your friends know you by.');
      return;
    }
    renameParticipant(host.id, name);
    setNaming(false);
    void invite({ ...trip, participants: trip.participants.map((p) => (p.id === host.id ? { ...p, name } : p)) });
  }

  function clearDevice() {
    clearAll();
    clearDeviceData();
    setClearing(false);
  }

  return (
    <section className={styles.panel} aria-labelledby="invite-title">
      <p id="invite-title" className={styles.factTitle}>
        {guest ? `You’re on ${trip.joinedFrom ? `${trip.joinedFrom}’s` : 'this'} trip` : 'Bring the crew'}
      </p>
      <p className="mt-1 text-[13px] leading-5 text-ink-muted">
        {guest
          ? `You’re voting as ${voter?.name ?? 'yourself'}. Your picks stay on this phone until you send them; they merge into ${sender.to}’s plan when ${sender.to === 'the organizer' ? 'they open' : `${sender.to} opens`} the link.`
          : 'The whole trip travels inside the link, so there’s no sign-up. Friends vote on their own phone and send their picks back with one tap.'}
      </p>
      {naming && !guest ? (
        <form
          className="mt-3"
          onSubmit={(event) => {
            event.preventDefault();
            saveName();
          }}
        >
          <label className={styles.label}>
            What should your crew see you as?
            <input className={styles.input} value={hostName} maxLength={30} placeholder="Your first name" autoFocus onChange={(e) => setHostName(e.target.value)} />
          </label>
          <div className={`${styles.row} mt-3`}>
            <button type="submit" className={styles.cta}>
              Save and invite
            </button>
            <button type="button" className={styles.ghost} onClick={() => setNaming(false)}>
              Not now
            </button>
          </div>
        </form>
      ) : (
        <div className={`${styles.row} mt-3`}>
          {guest ? (
            <button type="button" className={styles.cta} onClick={() => void sender.send()} disabled={!voter}>
              Send my picks to {sender.to === 'the organizer' ? 'the organizer' : sender.to}
            </button>
          ) : null}
          <button type="button" className={guest ? styles.ghost : styles.cta} onClick={() => void invite()}>
            {guest ? 'Share the trip' : 'Invite people'}
          </button>
        </div>
      )}
      {placeholder && !naming ? <p className="mt-2 text-[12px] text-ink-muted">You’re “You” on this trip. We’ll ask what name to show your friends first.</p> : null}
      {status ? <p className="mt-2 text-[12px] text-ink-muted" role="status">{status}</p> : null}
      {sender.status && guest ? <p className="mt-2 text-[12px] text-ink-muted" role="status">{sender.status}</p> : null}
      {error || (guest && sender.error) ? <p className={styles.error} role="alert">{error || sender.error}</p> : null}
      {link ? <textarea className={styles.shareBox} readOnly rows={3} value={link} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} /> : null}
      {guest && sender.link ? <textarea className={styles.shareBox} readOnly rows={2} value={sender.link} aria-label="Picks link" onFocus={(e) => e.currentTarget.select()} /> : null}
      <p className="mt-2 text-[11px] leading-4 text-ink-subtle">
        {guest
          ? 'Your picks link carries your name and your votes. “Share the trip” sends the plan, names, kids’ ages, home city, and everyone’s votes so far. '
          : 'The invite carries names, kids’ ages, home city, the plan, and everyone’s votes so far, to anyone the link reaches. Interests, adults’ ages, and listening details stay on this device. '}
        Picks sync when a link is opened, not live.
      </p>
      <div className="mt-3 border-t border-white/[0.06] pt-3">
        {clearing ? (
          <div role="alertdialog" aria-labelledby="clear-device-title">
            <p id="clear-device-title" className="text-[13px] leading-5 text-ink-muted">
              Delete the trip, votes, saved mood boards, any trip set aside, and cached research from this browser? Links you already sent keep working for whoever has them.
            </p>
            <div className={`${styles.row} mt-2`}>
              <button type="button" className={styles.ghost} onClick={clearDevice}>
                Delete everything
              </button>
              <button type="button" className={styles.ghost} onClick={() => setClearing(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className={styles.miniBtn} onClick={() => setClearing(true)}>
            Clear everything on this device
          </button>
        )}
      </div>
    </section>
  );
}
