'use client';

import Link from 'next/link';
import { useState } from 'react';
import { DESTINATIONS, type DestinationId } from '@/lib/designer/catalog';
import { MAX_NIGHTS, MAX_PARTICIPANTS, composeLocally, participantStyle, type Itinerary, type Participant } from '@/lib/designer/itinerary';
import { EXAMPLE_RAMBLE } from '@/lib/designer/moodboard';
import { parseProfileLocally, profileTags, type TravelerProfile } from '@/lib/designer/profile';
import { useDesignerStore, type SavedProfile } from '@/lib/designer/store';
import styles from './designer.module.css';
import { useHydrated } from './useHydrated';
import { TripCanvas } from './TripCanvas';

type Draft = { key: string; name: string; kind: 'adult' | 'kid'; age?: number; tags: string[]; board?: string };

function localIso(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** One mood board becomes the whole traveling party it describes. */
export function travelersFromBoard(board: { id: string; profile: TravelerProfile }): Draft[] {
  const { profile } = board;
  const adultTags = profileTags(profile).filter((tag) => !tag.endsWith('kids'));
  const people: Draft[] = [
    { key: `${board.id}:self`, name: profile.name ?? 'You', kind: 'adult', age: profile.age, tags: adultTags, board: board.id },
  ];
  profile.family.forEach((member, i) => {
    const kid = member.relation === 'child' || (member.age !== undefined && member.age < 18);
    const tags = kid ? [] : member.relation === 'partner' ? adultTags : [];
    people.push({
      key: `${board.id}:m${i}`,
      name: member.name ?? (member.age !== undefined ? `${member.label} (${member.age})` : member.label),
      kind: kid ? 'kid' : 'adult',
      age: member.age,
      tags,
      board: board.id,
    });
  });
  return people;
}

function Setup({ boards, initialWith, onCreate }: { boards: SavedProfile[]; initialWith?: string; onCreate: (trip: Itinerary, notice?: string) => void }) {
  const [destination, setDestination] = useState<DestinationId>('st-moritz');
  const [startDate, setStartDate] = useState(() => localIso(60));
  const [nights, setNights] = useState(7);
  const initialBoard = boards.find((board) => board.id === initialWith) ?? boards[0];
  const [hometown, setHometown] = useState(initialBoard?.profile.hometown ?? '');
  const [travelers, setTravelers] = useState<Draft[]>(() => (initialBoard ? travelersFromBoard(initialBoard) : []));
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'adult' | 'kid'>('adult');
  const [age, setAge] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const selectedBoards = new Set(travelers.map((t) => t.board).filter(Boolean));

  function toggleBoard(board: SavedProfile) {
    if (selectedBoards.has(board.id)) {
      setTravelers((list) => list.filter((t) => t.board !== board.id));
      return;
    }
    setTravelers((list) => [...list, ...travelersFromBoard(board)].slice(0, MAX_PARTICIPANTS));
    if (!hometown && board.profile.hometown) setHometown(board.profile.hometown);
  }

  function useExample() {
    const profile = parseProfileLocally(EXAMPLE_RAMBLE);
    setTravelers(travelersFromBoard({ id: 'example', profile }));
    setHometown(profile.hometown ?? '');
  }

  function addTraveler() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const parsedAge = age ? Number(age) : undefined;
    setTravelers((list) =>
      [...list, { key: `q-${Date.now()}`, name: trimmed.slice(0, 30), kind, age: Number.isFinite(parsedAge) ? parsedAge : undefined, tags: [] }].slice(0, MAX_PARTICIPANTS),
    );
    setName('');
    setAge('');
  }

  async function create() {
    setError('');
    if (!travelers.length) {
      setError('Add at least one traveler, or pick a mood board.');
      return;
    }
    if (startDate < localIso(0)) {
      setError('Pick a start date from today onward.');
      return;
    }
    setBusy(true);
    const participants: Participant[] = travelers.map((t, i) => ({ id: `p${i}`, name: t.name, kind: t.kind, age: t.age, tags: t.tags, ...participantStyle(i) }));
    const boardIds = new Set(travelers.map((t) => t.board));
    const profileNotes = boards.filter((b) => boardIds.has(b.id)).map((b) => b.profile.summary).filter(Boolean);
    const input = { destination, startDate, nights, hometown: hometown.trim() || undefined, participants };
    try {
      const response = await fetch('/api/designer/itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, profileNotes }),
      });
      const body = (await response.json()) as { itinerary?: Itinerary; notice?: string; error?: string };
      if (!response.ok || !body.itinerary) throw new Error(body.error ?? 'The designer could not build that trip.');
      onCreate(body.itinerary, body.notice);
    } catch (cause) {
      if (cause instanceof Error && cause.message !== 'Failed to fetch' && !(cause instanceof SyntaxError)) {
        setError(cause.message);
      } else {
        onCreate(composeLocally(input), 'Offline, so this draft was built on the device.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className={styles.eyebrow}>Trip designer · step 2 of 2</p>
      <h1 className={styles.headline}>
        Where are we going? <span className={styles.gradientText}>Let’s build the hype.</span>
      </h1>
      <p className={styles.lede}>
        Pick a place and dates, add the crew, and we’ll lay out the whole trip as a timeline of ideas: every slot a row of options
        everyone can drag, swipe, and vote on.
      </p>

      <div className={styles.destGrid} role="radiogroup" aria-label="Destination">
        {DESTINATIONS.map((d) => (
          <button
            key={d.id}
            type="button"
            role="radio"
            aria-checked={destination === d.id}
            className={`${styles.destCard} ${destination === d.id ? styles.destCardOn : ''}`}
            onClick={() => setDestination(d.id)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local editorial file */}
            <img className={styles.heroImage} src={d.hero} alt="" />
            <span className={styles.heroShade} />
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] opacity-80">
              {d.kind === 'ski' ? '⛷️ Ski' : '🏝️ Beach'} · {d.region}
            </span>
            <span className={styles.destName}>{d.name}</span>
            <span className="mt-1 text-[12.5px] leading-5 opacity-90">{d.tagline}</span>
          </button>
        ))}
      </div>

      <div className={styles.panel}>
        <div className={styles.fieldGrid}>
          <label className={styles.label}>
            First day
            <input className={styles.input} type="date" value={startDate} min={localIso(0)} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className={styles.label}>
            Nights
            <input
              className={styles.input}
              type="number"
              min={1}
              max={MAX_NIGHTS}
              value={nights}
              onChange={(e) => setNights(Math.min(MAX_NIGHTS, Math.max(1, Number(e.target.value) || 1)))}
            />
          </label>
          <label className={styles.label}>
            Traveling from
            <input className={styles.input} value={hometown} maxLength={60} placeholder="Atlanta, Georgia" onChange={(e) => setHometown(e.target.value)} />
          </label>
        </div>
      </div>

      <div className={styles.panel}>
        <p className={styles.factTitle}>Who’s going</p>
        {boards.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {boards.map((board) => (
              <button
                key={board.id}
                type="button"
                className={`${styles.traveler} ${selectedBoards.has(board.id) ? styles.travelerOn : ''}`}
                onClick={() => toggleBoard(board)}
                aria-pressed={selectedBoards.has(board.id)}
              >
                <span className={styles.avatar} style={{ background: 'linear-gradient(135deg,#f97316,#ec4899)' }}>
                  ✨
                </span>
                {board.profile.name ?? board.profile.hometown ?? 'Mood board'} + party
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[13px] text-ink-muted">
            No mood boards on this device yet.{' '}
            <Link href="/moodboard" className="text-[#fdba74] underline underline-offset-4">
              Make one by talking
            </Link>{' '}
            or{' '}
            <button type="button" className="text-[#fdba74] underline underline-offset-4" onClick={useExample}>
              use the example family
            </button>
            .
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {travelers.map((t, i) => {
            const style = participantStyle(i);
            return (
              <span key={t.key} className={styles.traveler}>
                <span className={styles.avatar} style={{ background: style.color }}>
                  {style.emoji}
                </span>
                {t.name}
                {t.kind === 'kid' ? ' · kid' : ''}
                <button
                  type="button"
                  className={styles.chipX}
                  onClick={() => setTravelers((list) => list.filter((x) => x.key !== t.key))}
                  aria-label={`Remove ${t.name}`}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className={styles.label}>
            Add someone
            <input className={styles.input} value={name} maxLength={30} placeholder="Name" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTraveler()} />
          </label>
          <label className={styles.label}>
            Age
            <input className={styles.input} style={{ width: 80 }} inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, '').slice(0, 3))} />
          </label>
          <div className={styles.seg} role="group" aria-label="Adult or kid">
            {(['adult', 'kid'] as const).map((value) => (
              <button key={value} type="button" className={`${styles.segBtn} ${kind === value ? styles.segOn : ''}`} onClick={() => setKind(value)} aria-pressed={kind === value}>
                {value === 'adult' ? 'Adult' : 'Kid'}
              </button>
            ))}
          </div>
          <button type="button" className={styles.ghost} onClick={addTraveler} disabled={!name.trim()}>
            + Add
          </button>
        </div>
      </div>

      <div className={`${styles.row} mt-6`}>
        <button type="button" className={styles.cta} onClick={create} disabled={busy}>
          {busy ? 'Designing your week…' : '✨ Design the itinerary'}
        </button>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function TripDesigner({ initialWith }: { initialWith?: string }) {
  const mounted = useHydrated();
  const [notice, setNotice] = useState<string | undefined>();
  const [withId, setWithId] = useState(initialWith);
  const trip = useDesignerStore((state) => state.trip);
  const setTrip = useDesignerStore((state) => state.setTrip);
  const clearTrip = useDesignerStore((state) => state.clearTrip);
  const boards = useDesignerStore((state) => state.profiles);


  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        {!mounted ? (
          <p className="py-16 text-ink-muted">Opening the designer…</p>
        ) : trip && !withId ? (
          <>
            {notice ? <p className={styles.notice}>{notice}</p> : null}
            <TripCanvas
              trip={trip}
              onRestart={() => {
                if (window.confirm('Start a new trip? This clears the current draft and its votes from this device.')) {
                  clearTrip();
                  setNotice(undefined);
                }
              }}
            />
          </>
        ) : trip && withId ? (
          <ReplacePrompt
            onKeep={() => {
              window.history.replaceState(null, '', '/trips/designer');
              setWithId(undefined);
            }}
            onReplace={clearTrip}
          />
        ) : (
          <Setup
            key={withId ?? 'new'}
            boards={boards}
            initialWith={withId}
            onCreate={(created, message) => {
              setTrip(created);
              setNotice(message);
              if (withId) {
                window.history.replaceState(null, '', '/trips/designer');
                setWithId(undefined);
              }
              window.scrollTo({ top: 0 });
            }}
          />
        )}
      </div>
    </main>
  );
}

function ReplacePrompt({ onKeep, onReplace }: { onKeep: () => void; onReplace: () => void }) {
  return (
    <div className={styles.panel}>
      <p className="font-display text-[26px] text-ink">You already have a trip in the works.</p>
      <p className="mt-2 text-[14px] text-ink-muted">Keep designing it, or start a new trip with this mood board? Starting over clears the draft and its votes on this device.</p>
      <div className={`${styles.row} mt-4`}>
        <button
          type="button"
          className={styles.cta}
          onClick={onKeep}
        >
          Keep my trip
        </button>
        <button type="button" className={styles.ghost} onClick={onReplace}>
          Start a new trip
        </button>
      </div>
    </div>
  );
}
