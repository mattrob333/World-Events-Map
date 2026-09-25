'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { MAX_PARTICIPANTS, nextParticipantStyle, resolveDestination, type Itinerary, type Participant } from '@/lib/designer/itinerary';
import { localCopyOf, useDesignerStore } from '@/lib/designer/store';
import {
  LinkError,
  checkReply,
  cleanText,
  linkHint,
  mergeReply,
  plural,
  readReplyLink,
  readTripLink,
  replyFor,
  type MergeSummary,
  type SharedTrip,
  type TripReply,
} from '@/lib/designer/tripShare';
import type { TripVotes } from '@/lib/designer/votes';
import styles from './designer.module.css';
import { useHydrated } from './useHydrated';

function subscribeHash(callback: () => void) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

type Opened =
  | { kind: 'trip'; shared: SharedTrip }
  | { kind: 'reply'; reply: TripReply }
  | { kind: 'error'; message: string; incomplete: boolean; hint?: string }
  | { kind: 'empty' };

function formatDay(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function formatSent(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const sameName = (a: string, b: string) => a.normalize('NFKC').trim().toLocaleLowerCase() === b.normalize('NFKC').trim().toLocaleLowerCase();

function voteCount(votes: TripVotes): number {
  let count = 0;
  for (const slot of Object.values(votes)) for (const card of Object.values(slot)) count += Object.keys(card).length;
  return count;
}

function votesBy(votes: TripVotes, personId: string): number {
  let count = 0;
  for (const slot of Object.values(votes)) for (const card of Object.values(slot)) if (Object.hasOwn(card, personId)) count += 1;
  return count;
}

/** "your Tokyo trip (2 travelers, 1 vote)" or "your copy of Matt’s Paris trip (…)". */
function describeTrip(trip: Itinerary, votes: TripVotes): { place: string; text: string } {
  const place = resolveDestination(trip)?.name ?? 'other';
  const whose = trip.joinedFrom !== undefined ? `your copy of ${trip.joinedFrom ? `${trip.joinedFrom}’s` : 'a friend’s'}` : 'your';
  return { place, text: `${whose} ${place} trip (${plural(trip.participants.length, 'traveler')}, ${plural(voteCount(votes), 'vote')})` };
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
    const hint = linkHint(hash);
    const read: Promise<Opened> = trip
      ? readTripLink(trip).then((shared) => ({ kind: 'trip', shared }))
      : reply
        ? readReplyLink(reply).then((value) => ({ kind: 'reply', reply: value }))
        : Promise.resolve({ kind: 'empty' });
    read
      .catch(
        (cause: unknown): Opened =>
          cause instanceof LinkError
            ? cause.kind === 'empty'
              ? { kind: 'empty' }
              : { kind: 'error', message: cause.message, incomplete: cause.kind === 'incomplete', hint }
            : // Never show a raw browser exception: they read like network failures.
              { kind: 'error', message: 'That link couldn’t be opened.', incomplete: false, hint },
      )
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
              {value.kind === 'error'
                ? `${value.message} Ask ${value.hint ?? 'whoever sent it'} to send it again${value.incomplete ? '' : ', or plan your own trip'}.`
                : 'It may have been cut off when it was copied. Ask for the link again, or plan your own trip.'}
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

function Avatar({ person }: { person: Participant }) {
  return (
    <span className={styles.avatar} style={{ background: person.color }}>
      {person.emoji}
    </span>
  );
}

function JoinForm({ shared }: { shared: SharedTrip }) {
  const router = useRouter();
  const current = useDesignerStore((state) => state.trip);
  const currentVotes = useDesignerStore((state) => state.votes);
  const joinedAs = useDesignerStore((state) => state.joinedAs);
  const activeParticipant = useDesignerStore((state) => state.activeParticipant);
  const previousTrip = useDesignerStore((state) => state.previousTrip);
  const importTrip = useDesignerStore((state) => state.importTrip);
  const { trip, votes, from, handoff } = shared;
  const organizerId = handoff ? undefined : shared.organizer;
  const destination = resolveDestination(trip);
  const endDate = trip.days.at(-1)?.date ?? trip.startDate;
  const sameTrip = current?.id === trip.id;
  const restoreTrip = useDesignerStore((state) => state.restorePreviousTrip);
  // This device's copy of the linked trip, open or set aside (review S1).
  const local = localCopyOf(trip.id, { trip: current, votes: currentVotes, activeParticipant, joinedAs, previousTrip });
  const ownTrip = Boolean(local && local.trip.joinedFrom === undefined);
  const localGuest = Boolean(local && local.trip.joinedFrom !== undefined);
  // A friend who added themselves on this phone isn't in the organizer's link yet: keep them on the list.
  const localOnly = localGuest && local ? local.trip.participants.filter((p) => !trip.participants.some((q) => q.id === p.id)) : [];
  const people = [...trip.participants, ...localOnly];
  const before = localGuest && local ? [local.joinedAs, local.activeParticipant].find((pid) => pid && pid !== organizerId && people.some((p) => p.id === pid)) ?? null : null;
  const [me, setMe] = useState<string | null>(before);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const replacing = current && !sameTrip ? describeTrip(current, currentVotes) : null;
  const dropsOlder = replacing && previousTrip && previousTrip.trip.id !== trip.id && previousTrip.trip.id !== current?.id ? describeTrip(previousTrip.trip, previousTrip.votes) : null;
  const organizer = organizerId ? people.find((p) => p.id === organizerId) : undefined;
  const beforeName = before ? people.find((p) => p.id === before)?.name : undefined;

  function openOwn() {
    // A set-aside own trip comes back; the open one takes its slot, so nothing is lost.
    if (local?.setAside) restoreTrip();
    window.history.replaceState(null, '', '/trips/join');
    router.push('/trips/designer');
  }

  function join() {
    setError('');
    let who = me;
    let participants = people;
    const name = cleanText(newName).trim().slice(0, 30);
    if (!who && name) {
      if (people.length >= MAX_PARTICIPANTS) {
        setError(`This trip is full (${MAX_PARTICIPANTS} travelers).`);
        return;
      }
      const clash = people.find((p) => sameName(p.name, name));
      if (clash) {
        setError(
          clash.id === organizerId
            ? `${clash.name} is the organizer’s name. Add a last initial so ${clash.name} can tell you apart.`
            : `There’s already a ${clash.name} on this trip. Tap that name if it’s you, or add a last initial.`,
        );
        return;
      }
      who = `g-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      participants = [...people, { id: who, name, kind: 'adult', tags: [], ...nextParticipantStyle(people) }];
    }
    if (!who || who === organizerId) {
      setError('Tap your name, or add yourself.');
      return;
    }
    // An agent-built trip belongs to whoever opens it (they become the first traveler, the organizer); a friend's trip is a guest copy.
    const chosen = who;
    const next: Itinerary = handoff
      ? { ...trip, participants: [...participants.filter((p) => p.id === chosen), ...participants.filter((p) => p.id !== chosen)] }
      : { ...trip, participants, joinedFrom: from ?? '' };
    // Reopening a newer copy of a trip you already joined keeps the votes you made on this phone, under whoever made them.
    let merged = { trip: next, votes };
    if (localGuest && local) {
      for (const pid of new Set([before, who])) {
        if (pid && local.trip.participants.some((p) => p.id === pid)) merged = mergeReply(merged.trip, merged.votes, replyFor(local.trip, local.votes, pid));
      }
    }
    importTrip(merged.trip, merged.votes, who);
    window.history.replaceState(null, '', '/trips/join');
    router.push('/trips/designer');
  }

  if (ownTrip) {
    return (
      <>
        <h1 className={styles.headline}>
          This is your trip. <span className={styles.accentText}>{destination?.name ?? 'Somewhere good'}.</span>
        </h1>
        <p className={styles.lede}>
          {formatDay(trip.startDate)} → {formatDay(endDate)} · {trip.nights} nights.{' '}
          {local?.setAside
            ? 'It’s set aside on this device with your latest changes and everyone’s picks. This is the link you sent the crew.'
            : 'It’s already on this device with your latest changes. This is the link you sent the crew.'}
        </p>
        <div className={`${styles.row} mt-6`}>
          <button type="button" className={styles.cta} onClick={openOwn}>
            {local?.setAside ? `Restore my ${destination?.name ?? ''} trip →`.replace('  ', ' ') : 'Open my trip →'}
          </button>
        </div>
      </>
    );
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
          : `Say who you are, tap 👍 on what you’re into, and send your picks back to ${from || 'the organizer'}. No sign-up: the trip came inside the link.`}
      </p>
      {replacing ? (
        <div className={`${styles.notice} mt-4`} role="note">
          <p className="text-[14px] leading-6">
            <strong>This device already has {replacing.text}.</strong> {handoff ? 'Opening' : 'Joining'} this one puts it aside: tap “Restore my {replacing.place} trip” on the trip page to bring it back.
            {dropsOlder ? ` The older ${dropsOlder.place} trip set aside earlier will be removed to make room.` : ''}
          </p>
        </div>
      ) : null}
      <div className={styles.panel}>
        <p className={styles.factTitle}>Who are you?</p>
        {beforeName ? <p className="mt-1 text-[13px] text-ink-muted">You’re {beforeName} on this device. Your votes are still here.</p> : null}
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Who are you">
          {organizer ? (
            <span className={`${styles.traveler} opacity-70`} aria-disabled="true" title="The organizer sent this invite">
              <Avatar person={organizer} />
              {organizer.name} · organizer
            </span>
          ) : null}
          {people
            // Kids travel but don't vote, so a friend never picks one of them.
            .filter((person) => person.id !== organizerId && person.kind !== 'kid')
            .map((person) => (
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
                <Avatar person={person} />
                {person.name}
              </button>
            ))}
        </div>
        {beforeName && me && me !== before ? (
          <p className="mt-2 text-[13px] text-ink-muted" role="note">
            {beforeName}’s votes stay on this phone; from now on you’ll vote as {people.find((p) => p.id === me)?.name}.
          </p>
        ) : null}
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
          {handoff ? 'Open my trip →' : 'Join and vote →'}
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

function summaryText(summary: MergeSummary): string {
  const parts = [`Added ${plural(summary.loves, 'love')} and ${plural(summary.passes, 'pass', 'passes')} from ${summary.name}.`];
  if (summary.dropped) parts.push(`${plural(summary.dropped, 'pick')} ${summary.dropped === 1 ? 'was' : 'were'} for ${summary.dropped === 1 ? 'an idea' : 'ideas'} no longer in your plan.`);
  if (summary.added) parts.push(`${summary.name} is on the trip now.`);
  return parts.join(' ');
}

function MergeReply({ reply }: { reply: TripReply }) {
  const trip = useDesignerStore((state) => state.trip);
  const votes = useDesignerStore((state) => state.votes);
  const lastMergedAt = useDesignerStore((state) => state.lastMergedAt);
  const previousTrip = useDesignerStore((state) => state.previousTrip);
  const mergeInto = useDesignerStore((state) => state.mergeReply);
  const undoMerge = useDesignerStore((state) => state.undoMerge);
  const restorePreviousTrip = useDesignerStore((state) => state.restorePreviousTrip);
  const [done, setDone] = useState<MergeSummary | null>(null);
  const [error, setError] = useState('');
  const [undone, setUndone] = useState(false);
  const count = Object.values(reply.votes).reduce((sum, slot) => sum + Object.keys(slot).length, 0);
  const matches = trip?.id === reply.tripId;
  // Checked against the trip as it was before this link changed anything.
  const check = trip && matches && !done ? checkReply(trip, votes, reply, lastMergedAt) : null;
  const shownName = done?.name ?? check?.known?.name ?? reply.participant.name;
  const where = reply.place ? `${reply.place}${reply.startDate ? `, ${formatDay(reply.startDate)}` : ''}` : undefined;

  function merge(as?: string) {
    setError('');
    setUndone(false);
    try {
      setDone(mergeInto(reply, as ? { as } : undefined));
      window.history.replaceState(null, '', '/trips/join');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Those picks could not be added.');
    }
  }

  function undo() {
    if (undoMerge()) {
      setDone(null);
      setUndone(true);
    }
  }

  const header = (
    <>
      <h1 className={styles.headline}>
        {check && (check.organizer || check.nameMismatch) ? `Picks signed “${reply.participant.name}”.` : `${shownName} sent their picks.`}{' '}
        <span className={styles.accentText}>{plural(count, 'vote')}.</span>
      </h1>
      {where || reply.at ? (
        <p className="mt-2 text-[13px] text-ink-muted">
          {where ? `For ${where}` : ''}
          {where && reply.at ? ' · ' : ''}
          {reply.at ? `sent ${formatSent(reply.at)}` : ''}
        </p>
      ) : null}
    </>
  );

  if (!trip || !matches) {
    const setAside = previousTrip?.trip.id === reply.tripId ? resolveDestination(previousTrip.trip)?.name ?? 'that' : null;
    return (
      <>
        {header}
        <p className={styles.lede}>
          {setAside
            ? `These picks are for your ${setAside} trip, which is set aside on this device. Bring it back, then add them.`
            : `These are ${reply.participant.name}’s picks${where ? ` for ${where}` : ''}. That trip isn’t open on this device. Open this link on the device where you planned it. If you started a new trip since, these picks can’t be added to it.`}
        </p>
        <div className={`${styles.row} mt-6`}>
          {setAside ? (
            <button type="button" className={styles.cta} onClick={restorePreviousTrip}>
              Restore my {setAside} trip
            </button>
          ) : (
            <Link href="/trips/designer" className={styles.ghost}>
              Go to my trip
            </Link>
          )}
        </div>
      </>
    );
  }

  if (done) {
    return (
      <>
        {header}
        <p className={`${styles.lede}`} role="status">
          {summaryText(done)}
        </p>
        <div className={`${styles.row} mt-6`}>
          <Link href="/trips/designer" className={styles.cta}>
            See the group’s faves →
          </Link>
          <button type="button" className={styles.ghost} onClick={undo}>
            Undo
          </button>
        </div>
      </>
    );
  }

  if (!check) return header;
  const { preview, known, duplicateOf } = check;
  const diff = [
    `Adds ${plural(preview.loves, 'love')} and ${plural(preview.passes, 'pass', 'passes')}`,
    preview.replaced ? `replacing ${preview.name}’s ${plural(preview.replaced, 'earlier vote')}` : '',
  ]
    .filter(Boolean)
    .join(', ');
  const dropped = preview.dropped ? `${plural(preview.dropped, 'pick')} ${preview.dropped === 1 ? 'is' : 'are'} for ${preview.dropped === 1 ? 'an idea' : 'ideas'} no longer in your plan and won’t be added.` : '';
  const duplicateVotes = duplicateOf ? votesBy(votes, duplicateOf.id) : 0;

  return (
    <>
      {header}
      <p className={styles.lede}>
        {diff}. {dropped}
      </p>
      {undone ? (
        <p className="mt-2 text-[13px] text-ink-muted" role="status">
          Undone. Nothing from this link is on your trip.
        </p>
      ) : null}

      {check.organizer && known ? (
        <div className={`${styles.notice} mt-4`} role="alert">
          <p className="text-[14px] leading-6">
            <strong>This link would replace your own votes.</strong> It claims to be from {known.name}, the organizer
            {sameName(known.name, reply.participant.name) ? '' : ` (it’s signed “${reply.participant.name}”)`}. Only add it if you sent it yourself from another device.
          </p>
        </div>
      ) : check.nameMismatch && known ? (
        <div className={`${styles.notice} mt-4`} role="alert">
          <p className="text-[14px] leading-6">
            <strong>The name doesn’t match.</strong> This link is signed “{reply.participant.name}”, but on your trip that spot belongs to {known.name}. Adding it replaces {known.name}’s votes.
          </p>
        </div>
      ) : null}
      {check.newerMergedAt ? (
        <div className={`${styles.notice} mt-4`} role="note">
          <p className="text-[14px] leading-6">
            <strong>This is an older picks link from {shownName}.</strong> It was sent {reply.at ? formatSent(reply.at) : 'earlier'}; you already added a newer one sent {formatSent(check.newerMergedAt)}. It’s skipped so the newer picks stay.
          </p>
        </div>
      ) : null}
      {duplicateOf ? (
        <div className={`${styles.notice} mt-4`} role="note">
          <p className="text-[14px] leading-6">
            <strong>There’s already a {duplicateOf.name} on your trip.</strong> Is this the same person? Combining replaces that {duplicateOf.name}’s {plural(duplicateVotes, 'vote')} with these.
          </p>
        </div>
      ) : null}

      <div className={`${styles.row} mt-6`}>
        {check.newerMergedAt ? (
          <>
            <Link href="/trips/designer" className={styles.cta}>
              Keep the newer picks
            </Link>
            <button type="button" className={styles.ghost} onClick={() => merge()}>
              Add this older link anyway
            </button>
          </>
        ) : check.organizer && known ? (
          <>
            <Link href="/trips/designer" className={styles.cta}>
              Don’t add it
            </Link>
            <button type="button" className={styles.ghost} onClick={() => merge()}>
              Replace my ({known.name}’s) votes
            </button>
          </>
        ) : check.nameMismatch && known ? (
          <>
            <Link href="/trips/designer" className={styles.cta}>
              Don’t add it
            </Link>
            <button type="button" className={styles.ghost} onClick={() => merge()}>
              Replace {known.name}’s votes
            </button>
          </>
        ) : duplicateOf ? (
          <>
            <button type="button" className={styles.cta} onClick={() => merge(duplicateOf.id)}>
              Same person: combine
            </button>
            <button type="button" className={styles.ghost} onClick={() => merge()}>
              Someone else: add as new
            </button>
          </>
        ) : (
          <button type="button" className={styles.cta} onClick={() => merge()}>
            Add {shownName}’s picks
          </button>
        )}
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </>
  );
}
