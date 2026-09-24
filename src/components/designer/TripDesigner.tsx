'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { DESTINATIONS, type DestinationKind } from '@/lib/designer/catalog';
import { MAX_NIGHTS, MAX_PARTICIPANTS, composeLocally, participantStyle, type Itinerary, type Participant, type TripDestination } from '@/lib/designer/itinerary';
import type { PlaceSpec } from '@/lib/designer/place';
import { EXAMPLE_RAMBLE } from '@/lib/designer/moodboard';
import { parseProfileLocally, profileTags, type TravelerProfile } from '@/lib/designer/profile';
import { mergeTastes, tasteFrom } from '@/lib/designer/scene';
import { pickActiveProfile, useDesignerStore, type SavedProfile } from '@/lib/designer/store';
import { planPlaceFromParams, type PlanPlace } from '@/lib/search/planPlace';
import { useVoicePage } from '@/lib/voice/registry';
import styles from './designer.module.css';
import { useHydrated } from './useHydrated';
import { TripCanvas } from './TripCanvas';
import { photoImageProps } from '@/lib/place-media/sources';

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

/** "Lisbon, Portugal" → { name: 'Lisbon', region: 'Portugal' }. */
export function placeFromInput(value: string, kind: DestinationKind): PlaceSpec | undefined {
  const cleaned = value.replace(/\s+/g, ' ').trim().slice(0, 80);
  if (cleaned.length < 2) return undefined;
  const [name, ...rest] = cleaned.split(',').map((part) => part.trim()).filter(Boolean);
  if (!name) return undefined;
  return { name: name.slice(0, 60), region: rest.join(', ').slice(0, 60) || undefined, kind };
}

const KIND_LABEL: Record<DestinationKind, string> = { city: '🏙️ City', beach: '🏝️ Beach', ski: '⛷️ Ski' };

function Setup({ boards, initialWith, initialPlace, onCreate }: { boards: SavedProfile[]; initialWith?: string; initialPlace?: PlanPlace; onCreate: (trip: Itinerary, notice?: string) => void }) {
  const [destination, setDestination] = useState<TripDestination>('custom');
  // ?place=Munich&region=Germany (from a destination or search) fills "Where to?";
  // it never creates the trip or runs research on its own.
  const [placeText, setPlaceText] = useState(() => (initialPlace ? [initialPlace.place, initialPlace.region].filter(Boolean).join(', ') : ''));
  const [placeKind, setPlaceKind] = useState<DestinationKind>('city');
  const [startDate, setStartDate] = useState(() => localIso(60));
  const [nights, setNights] = useState(7);
  const initialBoard = boards.find((board) => board.id === initialWith) ?? pickActiveProfile(boards, useDesignerStore.getState().activeProfileId);
  const [hometown, setHometown] = useState(initialBoard?.profile.hometown ?? '');
  const [travelers, setTravelers] = useState<Draft[]>(() => (initialBoard ? travelersFromBoard(initialBoard) : []));
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'adult' | 'kid'>('adult');
  const [age, setAge] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const selectedBoards = new Set(travelers.map((t) => t.board).filter(Boolean));

  // Switching "Traveling as" (header or voice) swaps the crew to that profile's people.
  useEffect(
    () =>
      useDesignerStore.subscribe((state, prev) => {
        if (state.activeProfileId === prev.activeProfileId) return;
        const next = pickActiveProfile(state.profiles, state.activeProfileId);
        if (!next) return;
        setTravelers(travelersFromBoard(next));
        if (next.profile.hometown) setHometown(next.profile.hometown);
      }),
    [],
  );

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

  /** Builds the trip; returns an error sentence, or '' when it was created. */
  async function create(): Promise<string> {
    setError('');
    const fail = (message: string) => {
      setError(message);
      return message;
    };
    if (!travelers.length) return fail('Add at least one traveler, or pick a mood board.');
    if (startDate < localIso(0)) return fail('Pick a start date from today onward.');
    const place = destination === 'custom' ? placeFromInput(placeText, placeKind) : undefined;
    if (destination === 'custom' && !place) return fail('Type where you’re going, like “Lisbon, Portugal”.');
    const participants: Participant[] = travelers.map((t, i) => ({ id: `p${i}`, name: t.name, kind: t.kind, age: t.age, tags: t.tags, ...participantStyle(i) }));
    const boardIds = new Set(travelers.map((t) => t.board));
    const chosenBoards = boards.filter((b) => boardIds.has(b.id));
    const profileNotes = chosenBoards.map((b) => b.profile.summary).filter(Boolean);
    const taste = mergeTastes(chosenBoards.map((b) => tasteFrom(b.profile)));
    const input = { destination, startDate, nights, hometown: hometown.trim() || undefined, participants };
    if (place) {
      // Anywhere trips are built on this device from live searches, shaped by the crew's food and music.
      const foods = [...new Set(chosenBoards.flatMap((b) => b.profile.food))].slice(0, 3);
      onCreate(
        { ...composeLocally({ ...input, place, foods, taste }), taste },
        `Every card for ${place.name} opens a live search: Maps, YouTube, or Instagram. Check hours and bookings before you go.`,
      );
      return '';
    }
    setBusy(true);
    try {
      const response = await fetch('/api/designer/itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, profileNotes }),
      });
      const body = (await response.json()) as { itinerary?: Itinerary; notice?: string; error?: string };
      if (!response.ok || !body.itinerary) throw new Error(body.error ?? 'The designer could not build that trip.');
      onCreate({ ...body.itinerary, taste }, body.notice);
      return '';
    } catch (cause) {
      if (cause instanceof Error && cause.message !== 'Failed to fetch' && !(cause instanceof SyntaxError)) {
        return fail(cause.message);
      }
      onCreate({ ...composeLocally(input), taste }, 'Offline, so this draft was built on the device.');
      return '';
    } finally {
      setBusy(false);
    }
  }

  // Voice: the Sun fills this same form. Handlers run after React commits,
  // so create_trip sees the place and crew set earlier in the same turn.
  const createRef = useRef(create);
  useEffect(() => {
    createRef.current = create;
  });
  const settle = () => new Promise((resolve) => window.setTimeout(resolve, 60));
  useVoicePage(
    'trip',
    {
      set_trip_basics: (args) => {
        const changed: string[] = [];
        if (typeof args.place === 'string' && args.place.trim()) {
          const text = [args.place, typeof args.region === 'string' ? args.region : ''].map((part) => part.trim()).filter(Boolean).join(', ');
          setDestination('custom');
          setPlaceText(text.slice(0, 80));
          changed.push(text);
        }
        if (args.kind === 'city' || args.kind === 'beach' || args.kind === 'ski') {
          setPlaceKind(args.kind);
          changed.push(`a ${args.kind} trip`);
        }
        if (typeof args.start_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(args.start_date)) {
          if (args.start_date < localIso(0)) return 'Error: that date has passed. Ask for a date from today on.';
          setStartDate(args.start_date);
          changed.push(`starting ${args.start_date}`);
        }
        if (typeof args.nights === 'number' && Number.isFinite(args.nights)) {
          const n = Math.max(1, Math.min(MAX_NIGHTS, Math.round(args.nights)));
          setNights(n);
          changed.push(`${n} nights`);
        }
        if (typeof args.hometown === 'string' && args.hometown.trim()) {
          setHometown(args.hometown.trim().slice(0, 60));
          changed.push(`from ${args.hometown.trim()}`);
        }
        return changed.length ? `Set: ${changed.join(', ')}.` : 'Nothing changed.';
      },
      add_traveler: (args) => {
        const who = typeof args.name === 'string' ? args.name.trim().slice(0, 30) : '';
        if (!who) return 'Error: I need a name.';
        const kidOrAdult: Draft['kind'] = args.kind === 'kid' ? 'kid' : 'adult';
        const years = typeof args.age === 'number' && Number.isFinite(args.age) ? Math.round(args.age) : undefined;
        if (travelers.length >= MAX_PARTICIPANTS) return `Error: the crew is full at ${MAX_PARTICIPANTS}.`;
        setTravelers((list) => [...list, { key: `v-${Date.now()}-${list.length}`, name: who, kind: kidOrAdult, age: years, tags: [] }].slice(0, MAX_PARTICIPANTS));
        return `Added ${who}${years !== undefined ? ` (${years})` : ''}.`;
      },
      remove_traveler: (args) => {
        const who = typeof args.name === 'string' ? args.name.trim().toLowerCase() : '';
        const match = travelers.find((t) => t.name.toLowerCase() === who) ?? travelers.find((t) => who && t.name.toLowerCase().includes(who));
        if (!match) return `Error: nobody called ${String(args.name)} is on the crew.`;
        setTravelers((list) => list.filter((t) => t.key !== match.key));
        return `Took ${match.name} off.`;
      },
      create_trip: async () => {
        await settle();
        const problem = await createRef.current();
        return problem ? `Error: ${problem}` : 'Built the trip; it is on screen now.';
      },
    },
    () => {
      const where = destination === 'custom' ? placeText || 'not set' : DESTINATIONS.find((d) => d.id === destination)?.name ?? destination;
      const crew = travelers.map((t) => (t.kind === 'kid' && t.age !== undefined ? `${t.name} (${t.age})` : t.name)).join(', ') || 'nobody yet';
      return `Trip setup form. Where: ${where}. Starts ${startDate}, ${nights} nights. From: ${hometown || 'not set'}. Crew: ${crew}.`;
    },
    (text) => {
      const place = placeFromInput(text.split(/\b(?:in|on|for|with|from)\b/i)[0] ?? text, placeKind);
      if (!place) return 'Type a place, like “Lisbon, Portugal”.';
      setDestination('custom');
      setPlaceText([place.name, place.region].filter(Boolean).join(', '));
      return `Put ${place.name} in “Where to?”. Set dates and crew on the page, then tap Design the itinerary.`;
    },
  );

  return (
    <div>
      <p className={styles.eyebrow}>Trip designer · step 2 of 2</p>
      <h1 className={styles.headline}>
        Where are we going? <span className={styles.accentText}>Let’s build the hype.</span>
      </h1>
      <p className={styles.lede}>
        Pick a place and dates, add the crew, and we’ll lay out the whole trip as a timeline of ideas: every slot a row of options
        everyone can drag, swipe, and vote on.
      </p>

      <div className={styles.destGrid} role="radiogroup" aria-label="Destination">
        <button
          type="button"
          role="radio"
          aria-checked={destination === 'custom'}
          className={`${styles.destCard} ${styles.destCardAnywhere} ${destination === 'custom' ? styles.destCardOn : ''}`}
          onClick={() => setDestination('custom')}
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-90">✦ Anywhere</span>
          <span className={styles.destName}>Somewhere else</span>
          <span className="mt-1 text-[12.5px] leading-5 opacity-90">Type any city, beach, or mountain town.</span>
        </button>
        {DESTINATIONS.map((d) => (
          <button
            key={d.id}
            type="button"
            role="radio"
            aria-checked={destination === d.id}
            className={`${styles.destCard} ${destination === d.id ? styles.destCardOn : ''}`}
            onClick={() => setDestination(d.id)}
          >
            {d.hero ? (
              /* eslint-disable-next-line @next/next/no-img-element -- local editorial file */
              <img className={styles.heroImage} {...photoImageProps({ imageUrl: d.hero }, 'card')} alt="" loading="lazy" decoding="async" />
            ) : null}
            <span className={styles.heroShade} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-90">
              {KIND_LABEL[d.kind]} · {d.region}
            </span>
            <span className={styles.destName}>{d.name}</span>
            <span className="mt-1 text-[12.5px] leading-5 opacity-90">{d.tagline}</span>
          </button>
        ))}
      </div>

      {destination === 'custom' ? (
        <div className={styles.panel}>
          <div className="flex flex-wrap items-end gap-3">
            <label className={`${styles.label} min-w-[min(100%,16rem)] flex-1`}>
              Where to?
              <input
                className={styles.input}
                value={placeText}
                maxLength={80}
                placeholder="Lisbon, Portugal"
                autoComplete="off"
                onChange={(e) => setPlaceText(e.target.value)}
              />
            </label>
            <div className={styles.seg} role="group" aria-label="Kind of trip">
              {(['city', 'beach', 'ski'] as DestinationKind[]).map((value) => (
                <button key={value} type="button" className={`${styles.segBtn} ${placeKind === value ? styles.segOn : ''}`} onClick={() => setPlaceKind(value)} aria-pressed={placeKind === value}>
                  {KIND_LABEL[value]}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2 text-[12px] leading-5 text-ink-subtle">
            We lay out the days from your crew’s food and music. Every idea opens a live search, so nothing is made up.
          </p>
        </div>
      ) : null}

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
            <input
              className={styles.input}
              value={hometown}
              maxLength={60}
              placeholder="Your home city (for fares)"
              autoComplete="address-level2"
              aria-describedby="traveling-from-hint"
              onChange={(e) => setHometown(e.target.value)}
            />
            <span id="traveling-from-hint" className={styles.hint}>
              {hometown.trim() ? 'We look up flights and fares from here.' : 'Add it to see flights and fares; without it we skip them.'}
            </span>
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
                <span className={styles.avatar} style={{ background: 'var(--color-brass)' }}>
                  ✨
                </span>
                {board.profile.name ?? board.profile.hometown ?? 'Mood board'} + party
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[13px] text-ink-muted">
            No mood boards on this device yet.{' '}
            <Link href="/moodboard" className="text-brass-bright underline underline-offset-4">
              Make one by talking
            </Link>{' '}
            or{' '}
            <button type="button" className="inline-flex min-h-11 items-center text-brass-bright underline underline-offset-4" onClick={useExample}>
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
        <button type="button" className={styles.cta} onClick={() => void create()} disabled={busy}>
          {busy ? 'Designing your week…' : 'Design the itinerary'}
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
  // Read once on first load (also on a client-side navigation, where
  // window.location is not updated yet). It only prefills "Where to?".
  const searchParams = useSearchParams();
  const [placeParam, setPlaceParam] = useState<PlanPlace | undefined>(() =>
    planPlaceFromParams(new URLSearchParams(searchParams?.toString() ?? '')) ?? undefined,
  );
  const trip = useDesignerStore((state) => state.trip);
  const setTrip = useDesignerStore((state) => state.setTrip);
  const clearTrip = useDesignerStore((state) => state.clearTrip);
  const boards = useDesignerStore((state) => state.profiles);


  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        {!mounted ? (
          <p className="py-16 text-ink-muted">Opening the designer…</p>
        ) : trip && !withId && !placeParam ? (
          <>
            {notice ? <p className={styles.notice}>{notice}</p> : null}
            <TripCanvas
              trip={trip}
              onRestart={() => {
                if (window.confirm('Start a new trip? This clears the current draft and its votes from this device, and picks links friends haven’t sent back yet can’t be added to a new trip.')) {
                  clearTrip();
                  setNotice(undefined);
                }
              }}
            />
          </>
        ) : trip && (withId || placeParam) ? (
          <ReplacePrompt
            place={placeParam?.place}
            onKeep={() => {
              window.history.replaceState(null, '', '/trips/designer');
              setWithId(undefined);
              setPlaceParam(undefined);
            }}
            onReplace={clearTrip}
          />
        ) : (
          <Setup
            key={withId ?? 'new'}
            boards={boards}
            initialWith={withId}
            initialPlace={placeParam}
            onCreate={(created, message) => {
              setTrip(created);
              setNotice(message);
              if (withId || placeParam) {
                window.history.replaceState(null, '', '/trips/designer');
                setWithId(undefined);
                setPlaceParam(undefined);
              }
              window.scrollTo({ top: 0 });
            }}
          />
        )}
      </div>
    </main>
  );
}

function ReplacePrompt({ place, onKeep, onReplace }: { place?: string; onKeep: () => void; onReplace: () => void }) {
  return (
    <div className={styles.panel}>
      <p className="font-display text-[26px] text-ink">You already have a trip in the works.</p>
      <p className="mt-2 text-[14px] text-ink-muted">Keep designing it, or start a new trip {place ? `to ${place}` : 'with this mood board'}? Starting over clears the draft and its votes on this device.</p>
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
