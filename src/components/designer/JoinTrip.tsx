'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { MAX_PARTICIPANTS, participantStyle, resolveDestination } from '@/lib/designer/itinerary';
import { useDesignerStore } from '@/lib/designer/store';
import { mergeReply, readReplyLink, readTripLink, replyFor, type SharedTrip, type TripReply } from '@/lib/designer/tripShare';
import styles from './designer.module.css';
import { useHydrated } from './useHydrated';

function subscribeHash(callback: () => void) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

type Opened = { kind: 'trip'; shared: SharedTrip } | { kind: 'reply'; reply: TripReply } | { kind: 'error'; message: string } | { kind: 'empty' };

function formatDay(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/**
 * Opens a shared trip (#t=) or a friend's picks (#r=). Both live in the link
 * fragment, so dope.travel's servers never see them.
 */
export function JoinTrip() {
  const hydrated = useHydrated();
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash, () => null);
  const [opened, setOpened] = useState<{ hash: string; value: Opened } | null>(null);

  useEffect(() => {
    if (hash === null) return;
    let live = true;
    const params = new URLSearchParams(hash.slice(1));
    const trip = params.get('t');
    const reply = params.get('r');
    const read: Promise<Opened> = trip
      ? readTripLink(trip).then((shared) => ({ kind: 'trip', shared }))
      : reply
        ? readReplyLink(reply).then((value) => ({ kind: 'reply', reply: value }))
        : Promise.resolve({ kind: 'empty' });
    read
      .catch((cause: unknown): Opened => ({ kind: 'error', message: cause instanceof Error ? cause.message : 'That link could not be opened.' }))
      .then((value) => live && setOpened({ hash, value }));
    return () => {
      live = false;
    };
  }, [hash]);

  const value = opened && opened.hash === hash ? opened.value : null;

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>Shared trip</p>
        {!hydrated || !value ? (
          <p className="py-16 text-ink-muted">Opening the trip…</p>
        ) : value.kind === 'trip' ? (
          <JoinForm shared={value.shared} />
        ) : value.kind === 'reply' ? (
          <MergeReply reply={value.reply} />
        ) : (
          <>
            <h1 className={styles.headline}>{value.kind === 'empty' ? 'This link has no trip in it.' : 'That link didn’t open.'}</h1>
            <p className={styles.lede}>
              {value.kind === 'error' ? `${value.message} ` : ''}It may have been cut off when it was copied. Ask for the link again, or plan your own trip.
            </p>
            <Link href="/trips/designer" className={`${styles.ghost} mt-6`}>
              Plan a trip
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

function JoinForm({ shared }: { shared: SharedTrip }) {
  const router = useRouter();
  const current = useDesignerStore((state) => state.trip);
  const currentVotes = useDesignerStore((state) => state.votes);
  const importTrip = useDesignerStore((state) => state.importTrip);
  const { trip, votes, from, handoff } = shared;
  const destination = resolveDestination(trip);
  const [me, setMe] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const endDate = trip.days.at(-1)?.date ?? trip.startDate;
  const sameTrip = current?.id === trip.id;

  function join() {
    setError('');
    // An agent-built trip belongs to whoever opens it; a friend's trip is a guest copy.
    let next = handoff ? trip : { ...trip, joinedFrom: from ?? '' };
    let who = me;
    const name = newName.trim().slice(0, 30);
    if (!who && name) {
      if (trip.participants.length >= MAX_PARTICIPANTS) {
        setError(`This trip is full (${MAX_PARTICIPANTS} travelers).`);
        return;
      }
      who = `g-${Date.now().toString(36)}`;
      next = { ...next, participants: [...trip.participants, { id: who, name, kind: 'adult', tags: [], ...participantStyle(trip.participants.length) }] };
    }
    if (!who) {
      setError('Tap your name, or add yourself.');
      return;
    }
    if (current && !sameTrip && !window.confirm('Open this trip? It replaces the trip draft on this device.')) return;
    // Keep the organizer's own copy intact if they open their own link.
    if (sameTrip && current && current.joinedFrom === undefined) {
      router.push('/trips/designer');
      return;
    }
    // Reopening a newer copy of a trip you already joined keeps the votes you made on this phone.
    const mine = sameTrip && current?.participants.some((p) => p.id === who) ? replyFor(current, currentVotes, who) : null;
    const merged = mine ? mergeReply(next, votes, mine) : { trip: next, votes };
    importTrip(merged.trip, merged.votes, who);
    window.history.replaceState(null, '', '/trips/join');
    router.push('/trips/designer');
  }

  return (
    <>
      <h1 className={styles.headline}>
        {handoff ? 'Your agent planned this.' : from ? `${from} wants you on this trip.` : 'You’re invited.'}{' '}
        <span className={styles.accentText}>{destination?.name ?? 'Somewhere good'}.</span>
      </h1>
      <p className={styles.lede}>
        {formatDay(trip.startDate)} → {formatDay(endDate)} · {trip.nights} nights.{' '}
        {handoff
          ? 'Say which one is you and it opens as your trip on this device. Then invite the crew.'
          : 'Say who you are, tap ♥ on what you’re into, and send your picks back. No sign-up: the trip came inside the link.'}
      </p>
      <div className={styles.panel}>
        <p className={styles.factTitle}>Who are you?</p>
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Who are you">
          {trip.participants.map((person) => (
            <button
              key={person.id}
              type="button"
              role="radio"
              aria-checked={me === person.id}
              className={`${styles.traveler} ${me === person.id ? styles.travelerOn : ''}`}
              onClick={() => {
                setMe(person.id);
                setNewName('');
              }}
            >
              <span className={styles.avatar} style={{ background: person.color }}>
                {person.emoji}
              </span>
              {person.name}
            </button>
          ))}
        </div>
        <label className={`${styles.label} mt-4`}>
          Not on the list? Add yourself
          <input
            className={styles.input}
            value={newName}
            maxLength={30}
            placeholder="Your name"
            onChange={(e) => {
              setNewName(e.target.value);
              if (e.target.value.trim()) setMe(null);
            }}
          />
        </label>
      </div>
      <div className={`${styles.row} mt-6`}>
        <button type="button" className={styles.cta} onClick={join}>
          {sameTrip && current?.joinedFrom === undefined ? 'This is your trip. Open it' : handoff ? 'Open my trip →' : 'Join and vote →'}
        </button>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </>
  );
}

function MergeReply({ reply }: { reply: TripReply }) {
  const trip = useDesignerStore((state) => state.trip);
  const mergeReply = useDesignerStore((state) => state.mergeReply);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const count = Object.values(reply.votes).reduce((sum, slot) => sum + Object.keys(slot).length, 0);

  function merge() {
    try {
      const { added } = mergeReply(reply);
      window.history.replaceState(null, '', '/trips/join');
      setResult({ ok: true, message: `${reply.participant.name}’s ${count} pick${count === 1 ? '' : 's'} are in${added ? ', and they’re on the trip now' : ''}.` });
    } catch (cause) {
      setResult({ ok: false, message: cause instanceof Error ? cause.message : 'Those picks could not be added.' });
    }
  }

  return (
    <>
      <h1 className={styles.headline}>
        {reply.participant.name} sent their picks. <span className={styles.accentText}>{count} votes.</span>
      </h1>
      <p className={styles.lede}>
        {trip?.id === reply.tripId
          ? 'Add them to your trip. If they voted before, their new picks replace the old ones.'
          : 'These picks belong to a trip that isn’t open on this device. Open them on the phone where you planned the trip.'}
      </p>
      <div className={`${styles.row} mt-6`}>
        {result?.ok ? (
          <Link href="/trips/designer" className={styles.cta}>
            See the group’s faves →
          </Link>
        ) : (
          <button type="button" className={styles.cta} onClick={merge} disabled={trip?.id !== reply.tripId}>
            Add their picks
          </button>
        )}
        {result ? (
          <p className={result.ok ? 'text-[13px] text-ink-muted' : styles.error} role={result.ok ? 'status' : 'alert'}>
            {result.message}
          </p>
        ) : null}
      </div>
    </>
  );
}
