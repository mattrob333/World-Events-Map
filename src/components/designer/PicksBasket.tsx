'use client';

import { memberFetch } from '@/lib/platform/memberFetch';
import { useEffect, useMemo, useRef, useState } from 'react';
import { handoffNote, openTableSearch, takesTableSearch } from '@/lib/booking/partners';
import { adultsOnly, basketItems, crewLine, familyOrder, fitCandidates, kidAges, lodgingGuess, planWindow, profileLikes, schedulePicks, type BasketItem } from '@/lib/designer/basket';
import type { Itinerary } from '@/lib/designer/itinerary';
import { buildSchedule, type ScheduleInput, type ScheduleResult } from '@/lib/designer/schedule';
import { pickActiveProfile, useDesignerStore } from '@/lib/designer/store';
import type { DestinationResearch } from '@/lib/research/destinationSources';
import styles from './designer.module.css';
import { SourceLogo } from '@/components/brand/SourceLogo';

type Ranked = BasketItem & { band: 'standout' | 'good' | 'fine' | 'skip' | null; because: string | null };
type Phase = 'idle' | 'ranking' | 'deck' | 'picked' | 'schedule';

const BAND_LABEL = { standout: 'Standout for you', good: 'Good fit', fine: 'Could work', skip: 'Probably not you' } as const;
const KIND_EMOJI: Record<string, string> = { breakfast: '☕', lunch: '🍽️', dinner: '🍷', drinks: '🍸', nightlife: '🪩', sight: '📍', activity: '🧭', event: '🎟️' };
const MEALS = new Set(['breakfast', 'lunch', 'dinner']);

function storageKey(tripId: string) {
  return `dope.basket.v1:${tripId}`;
}

type Saved = { kept: string[]; passed: string[]; order: string[]; bands: Record<string, Ranked['band']>; rankedBy: 'fit' | 'rating' | null; index: number; phase: 'deck' | 'picked' | 'schedule'; pace: ScheduleInput['pace'] };

/** The deck as it was left on this device. Older saves were a bare list of keeps. */
function readSaved(tripId: string): Saved | null {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(storageKey(tripId)) ?? 'null');
    if (Array.isArray(raw)) return { kept: raw.filter((id): id is string => typeof id === 'string'), passed: [], order: [], bands: {}, rankedBy: null, index: 0, phase: 'picked', pace: 'balanced' };
    if (!raw || typeof raw !== 'object') return null;
    const value = raw as Partial<Saved>;
    const ids = (list: unknown) => (Array.isArray(list) ? list.filter((id): id is string => typeof id === 'string') : []);
    return {
      kept: ids(value.kept),
      passed: ids(value.passed),
      order: ids(value.order),
      bands: value.bands && typeof value.bands === 'object' ? value.bands : {},
      rankedBy: value.rankedBy === 'fit' || value.rankedBy === 'rating' ? value.rankedBy : null,
      index: Number.isInteger(value.index) && (value.index as number) >= 0 ? (value.index as number) : 0,
      phase: value.phase === 'deck' || value.phase === 'schedule' ? value.phase : 'picked',
      pace: value.pace === 'easy' || value.pace === 'packed' ? value.pace : 'balanced',
    };
  } catch {
    return null;
  }
}

/** "22:30–01:00 (+1)" when a block runs past midnight. */
function blockTime(start: string, end: string) {
  return `${start}–${end}${end < start ? ' (+1)' : ''}`;
}

/** Arrow keys belong to the deck only while nothing else wants them. */
function deckOwnsKey(event: KeyboardEvent, deck: HTMLElement | null) {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
  const target = event.target as HTMLElement | null;
  if (target?.closest('input, textarea, select, [contenteditable="true"], [role="tab"], [role="slider"]')) return false;
  if (document.querySelector('[aria-modal="true"]')) return false;
  if (!deck) return false;
  const box = deck.getBoundingClientRect();
  return box.bottom > 0 && box.top < window.innerHeight;
}

function shortDay(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/**
 * The basket: real listings this device already fetched, ranked for this
 * traveler and trip (Jev, or rating when Jev is off), swiped into keeps,
 * then fitted into time-blocked days by the deterministic scheduler.
 * Nothing here books; meals hand off to OpenTable.
 */
export function PicksBasket({ trip, research, placeName }: { trip: Itinerary; research: Omit<DestinationResearch, 'flights'>; placeName: string }) {
  const items = useMemo(() => basketItems(research), [research]);
  const profiles = useDesignerStore((s) => s.profiles);
  const activeProfileId = useDesignerStore((s) => s.activeProfileId);
  const profile = pickActiveProfile(profiles, activeProfileId)?.profile;
  const [phase, setPhase] = useState<Phase>('idle');
  const [ranked, setRanked] = useState<Ranked[]>([]);
  const [rankedBy, setRankedBy] = useState<'fit' | 'rating' | null>(null);
  const [index, setIndex] = useState(0);
  const [kept, setKept] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [pace, setPace] = useState<ScheduleInput['pace']>('balanced');
  const [schedule, setSchedule] = useState<ScheduleResult | null>(null);
  const [passed, setPassed] = useState<string[]>([]);
  const [drag, setDrag] = useState(0);
  const dragStart = useRef<number | null>(null);
  const deckRef = useRef<HTMLDivElement | null>(null);
  const restoredFor = useRef<string | null>(null);
  const kids = useMemo(() => kidAges(trip.participants), [trip.participants]);
  const planDays = useMemo(() => planWindow(trip.startDate, trip.nights), [trip.startDate, trip.nights]);
  const lodging = useMemo(() => lodgingGuess(items), [items]);

  const scheduleFor = (keptItems: Ranked[], chosenPace: ScheduleInput['pace']) => buildSchedule({
    startDate: planDays.startDate,
    days: planDays.days,
    dayStart: planDays.dayStart,
    lodging,
    picks: schedulePicks(keptItems.filter((item) => !adultsOnly(item, kids))),
    pace: chosenPace,
  });

  // The deck as it was left on this device comes back with the trip, once per
  // trip: a research refresh mid-deck doesn't throw the traveler out of it.
  useEffect(() => {
    if (restoredFor.current === trip.id || !items.length) return;
    restoredFor.current = trip.id;
    const saved = readSaved(trip.id);
    if (!saved) return;
    const byId = new Map(items.map((item) => [item.id, item]));
    const order = saved.order.length ? saved.order.filter((id) => byId.has(id)) : items.map((item) => item.id);
    const valid = saved.kept.filter((id) => byId.has(id));
    if (!order.length || (!valid.length && saved.phase !== 'deck')) return;
    const restored = order.map((id) => ({ ...byId.get(id)!, band: saved.bands[id] ?? null, because: null }));
    const timer = window.setTimeout(() => {
      setRanked(restored);
      setRankedBy(saved.rankedBy);
      setKept(valid);
      setPassed(saved.passed.filter((id) => byId.has(id)));
      setIndex(Math.min(saved.index, restored.length - 1));
      setPace(saved.pace);
      if (saved.phase === 'schedule' && valid.length) {
        setSchedule(scheduleFor(restored.filter((item) => valid.includes(item.id)).sort((a, b) => valid.indexOf(a.id) - valid.indexOf(b.id)), saved.pace));
        setPhase('schedule');
      } else setPhase(saved.phase === 'deck' ? 'deck' : 'picked');
    }, 0);
    return () => window.clearTimeout(timer);
    // scheduleFor reads the same trip inputs; restoring once per trip is the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id, items]);

  const persist = (patch: Partial<Saved>) => {
    const next: Saved = {
      kept, passed, order: ranked.map((item) => item.id), bands: Object.fromEntries(ranked.filter((item) => item.band).map((item) => [item.id, item.band])),
      rankedBy, index, phase: phase === 'deck' || phase === 'schedule' ? phase : 'picked', pace, ...patch,
    };
    try { window.localStorage.setItem(storageKey(trip.id), JSON.stringify(next)); } catch { /* in-memory still works */ }
  };

  const rank = async () => {
    setPhase('ranking');
    setError('');
    const crew = crewLine(trip.participants);
    try {
      const response = await memberFetch('/api/designer/basket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip: { place: placeName, when: `${trip.startDate}, ${trip.nights} nights`, crew },
          // Only what ranking needs: no names, no music, no free text about them.
          traveler: { words: '', likes: profileLikes(profile) },
          candidates: fitCandidates(items),
        }),
      });
      const body = (await response.json()) as { ranked?: { id: string; band: Ranked['band']; because: string | null }[]; rankedBy?: 'fit' | 'rating'; error?: string };
      if (!response.ok || !body.ranked) throw new Error(body.error ?? 'Couldn’t rank these right now.');
      const byId = new Map(items.map((item) => [item.id, item]));
      const next = familyOrder(body.ranked.flatMap((entry) => {
        const item = byId.get(entry.id);
        return item ? [{ ...item, band: entry.band, because: entry.because }] : [];
      }), kids);
      setRanked(next);
      setRankedBy(body.rankedBy ?? null);
      setIndex(0);
      setKept([]);
      setPassed([]);
      setSchedule(null);
      setPhase('deck');
      try {
        window.localStorage.setItem(storageKey(trip.id), JSON.stringify({
          kept: [], passed: [], order: next.map((item) => item.id), bands: Object.fromEntries(next.filter((item) => item.band).map((item) => [item.id, item.band])),
          rankedBy: body.rankedBy ?? null, index: 0, phase: 'deck', pace,
        } satisfies Saved));
      } catch { /* in-memory still works */ }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Couldn’t rank these right now.');
      setPhase('idle');
    }
  };

  const current = ranked[index];
  const decide = (keep: boolean) => {
    if (!current) return;
    const nextKept = keep ? [...kept.filter((id) => id !== current.id), current.id] : kept.filter((id) => id !== current.id);
    const nextPassed = keep ? passed.filter((id) => id !== current.id) : [...passed.filter((id) => id !== current.id), current.id];
    const done = index + 1 >= ranked.length;
    setKept(nextKept);
    setPassed(nextPassed);
    setDrag(0);
    if (done) setPhase('picked');
    else setIndex(index + 1);
    persist({ kept: nextKept, passed: nextPassed, index: done ? index : index + 1, phase: done ? 'picked' : 'deck' });
  };

  useEffect(() => {
    if (phase !== 'deck') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      if (!deckOwnsKey(event, deckRef.current)) return;
      event.preventDefault();
      decide(event.key === 'ArrowRight');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const keptItems = ranked.filter((item) => kept.includes(item.id)).sort((a, b) => kept.indexOf(a.id) - kept.indexOf(b.id));
  const heldForKids = keptItems.filter((item) => adultsOnly(item, kids));
  const fit = () => {
    setSchedule(scheduleFor(keptItems, pace));
    setPhase('schedule');
    persist({ phase: 'schedule' });
  };
  const choosePace = (value: ScheduleInput['pace']) => {
    setPace(value);
    persist({ pace: value });
  };
  const toPicked = () => {
    setPhase('picked');
    persist({ phase: 'picked' });
  };
  const startOver = () => {
    if (kept.length && !window.confirm(`Clear your ${kept.length} kept ${kept.length === 1 ? 'place' : 'places'} and choose again?`)) return;
    // Same research, same ranking: go through the deck again without asking for a new one.
    if (ranked.length && ranked.every((item) => items.some((candidate) => candidate.id === item.id))) {
      setKept([]);
      setPassed([]);
      setIndex(0);
      setSchedule(null);
      setPhase('deck');
      persist({ kept: [], passed: [], index: 0, phase: 'deck' });
      return;
    }
    void rank();
  };
  const paceMatters = useMemo(() => {
    if (phase !== 'schedule' || !schedule) return true;
    const shape = (result: ScheduleResult) => result.days.map((day) => day.blocks.map((block) => block.pickId).join(',')).join('|');
    const others = (['easy', 'balanced', 'packed'] as const).filter((value) => value !== pace).map((value) => shape(scheduleFor(keptItems, value)));
    return others.some((other) => other !== shape(schedule));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, schedule, pace]);
  const covers = Math.max(1, trip.participants.length);
  const byId = new Map(ranked.map((item) => [item.id, item]));
  const endDrag = () => {
    dragStart.current = null;
    setDrag(0);
  };

  if (items.length < 2) {
    return (
      <section className={styles.basket} aria-label="Your picks">
        <h3 className={styles.basketTitle}>Pick your winners</h3>
        <p className="mt-2 text-[13px] leading-5 text-ink-soft">
          {items.length ? 'Only one place came back from this look-around, so there’s nothing to choose between yet. Look around again later for more.' : 'No places came back from this look-around yet.'}
        </p>
      </section>
    );
  }

  return (
    <section className={styles.basket} aria-label="Your picks">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className={styles.basketTitle}>Pick your winners</h3>
        {phase !== 'idle' && phase !== 'ranking' && (
          <button type="button" className={styles.miniBtn} onClick={startOver}>Start over</button>
        )}
      </div>

      {phase === 'idle' && (
        <div className={styles.researchStart}>
          <p className="text-[13px] leading-5 text-ink-soft">
            {items.length} real places from this look-around. We’ll rank them for {profile ? 'you and this trip' : 'this trip'}, you keep the winners, and we fit them into your days.
            {kids.length ? ' Clubs go to the back of the deck because kids are coming.' : ''}
          </p>
          <button type="button" className={styles.ghost} onClick={() => void rank()}>Rank for my crew</button>
          <p className="text-[11px] leading-4 text-ink-subtle">
            Ranking sends these places, who’s coming (“{crewLine(trip.participants) || 'just you'}”, no names) and your food and interest likes to dope.travel. Nothing is kept.
          </p>
          {error && <p className={styles.error} role="alert">{error}</p>}
        </div>
      )}

      {phase === 'ranking' && <p className={styles.researchStatus} role="status">Ranking {items.length} places for {profile ? 'you' : 'this trip'}…</p>}

      {phase === 'deck' && current && (
        <div className={styles.pickDeck} ref={deckRef}>
          <p className="text-[12px] text-ink-muted" aria-live="polite">
            {index + 1} of {ranked.length} · {kept.length} kept{rankedBy === 'rating' ? ' · ranked by rating (fit check unavailable)' : ''}
          </p>
          <article
            className={styles.pickCard}
            style={{ transform: `translateX(${drag}px) rotate(${drag / 30}deg)` }}
            onPointerDown={(event) => {
              // Links and buttons on the card stay clickable; only the card itself drags.
              if ((event.target as HTMLElement).closest('a, button')) return;
              dragStart.current = event.clientX;
              (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => { if (dragStart.current !== null) setDrag(event.clientX - dragStart.current); }}
            onPointerUp={() => {
              if (dragStart.current === null) return;
              const moved = drag;
              dragStart.current = null;
              if (moved > 90) decide(true);
              else if (moved < -90) decide(false);
              else setDrag(0);
            }}
            onPointerCancel={endDrag}
            onLostPointerCapture={() => { if (dragStart.current !== null) endDrag(); }}
          >
            {current.image?.url ? (
              // Provider CDN image of this listing, as returned with it.
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.pickPhoto} src={current.image.url} alt={current.image.alt} referrerPolicy="no-referrer" draggable={false} />
            ) : <div className={styles.pickPhoto} aria-hidden="true">{KIND_EMOJI[current.kind]}</div>}
            <div className={styles.pickBody}>
              {current.band && <span className={styles.bandChip} data-band={current.band}>{BAND_LABEL[current.band]}</span>}
              {adultsOnly(current, kids) && <span className={styles.bandChip} data-band="skip">Adults only? Kids are coming</span>}
              <h4 className={styles.pickName}>{current.name}</h4>
              <p className={styles.researchMeta}>
                {current.rating !== undefined ? `★ ${current.rating.toFixed(1)}` : ''}{current.category ? ` · ${current.category}` : ''}{current.price ? ` · ${current.price}` : ''}
              </p>
              {current.because && <p className={styles.pickBecause}>{current.because}</p>}
              {current.snippet && <p className={styles.researchSnippet}>“{current.snippet}”</p>}
              <a className={styles.researchSource} href={current.url} target="_blank" rel="noopener noreferrer"><SourceLogo source={current.source} size={14} className="mr-1.5" />{current.source} ↗</a>
            </div>
          </article>
          <div className={styles.pickActions}>
            <button type="button" className={styles.pickPass} onClick={() => decide(false)} aria-label={`Pass on ${current.name}`}>Pass</button>
            <button type="button" className={styles.pickDone} onClick={toPicked}>Done choosing</button>
            <button type="button" className={styles.pickKeep} onClick={() => decide(true)} aria-label={`Keep ${current.name}`}>Keep ♥</button>
          </div>
          <p className="text-center text-[11px] text-ink-subtle">Swipe, or use ← and → keys.</p>
        </div>
      )}

      {phase === 'picked' && (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-[13px] text-ink-soft">{keptItems.length ? `${keptItems.length} kept.` : 'Nothing kept yet.'}</p>
          {keptItems.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {keptItems.map((item) => <li key={item.id} className="chip">{KIND_EMOJI[item.kind]} {item.name}</li>)}
            </ul>
          )}
          {heldForKids.length > 0 && (
            <p className="text-[12px] leading-4 text-ink-muted">
              {heldForKids.map((item) => item.name).join(', ')} {heldForKids.length === 1 ? 'stays' : 'stay'} out of the day plan: kids are coming. Check {heldForKids.length === 1 ? 'it' : 'them'} for an adults’ night.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-ink-muted">Pace</span>
            {(['easy', 'balanced', 'packed'] as const).map((value) => (
              <button key={value} type="button" className={`${styles.segBtn} ${pace === value ? styles.segOn : ''}`} onClick={() => choosePace(value)}>{value[0]!.toUpperCase() + value.slice(1)}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={styles.ghost} disabled={!keptItems.length} onClick={fit}>Fit {keptItems.length} into my days</button>
            {index + 1 < ranked.length && <button type="button" className={styles.miniBtn} onClick={() => { setPhase('deck'); persist({ phase: 'deck' }); }}>Keep choosing</button>}
          </div>
        </div>
      )}

      {phase === 'schedule' && schedule && (
        <div className="mt-3 flex flex-col gap-4">
          <p className="text-[12px] leading-4 text-ink-subtle">
            Placed {schedule.score.placed} of {schedule.score.total}, about {schedule.score.travelMin} minutes of getting around, counted from the middle of town. {planDays.note} Opening hours aren’t known for most places, so typical hours are assumed; check each place before you go. Table links open an OpenTable search; dope.travel doesn’t book.
          </p>
          {!paceMatters && <p className="text-[12px] leading-4 text-ink-muted">Your picks fit the same way at any pace. Pace changes things once you keep more than the days can hold.</p>}
          {schedule.days.map((day) => (
            <div key={day.date} className={styles.schedDay}>
              <h4 className={styles.schedDate}>{shortDay(day.date)}</h4>
              {day.blocks.length ? (
                <ol className="flex flex-col gap-2">
                  {day.blocks.map((block) => {
                    const item = byId.get(block.pickId);
                    return (
                      <li key={block.pickId} className={styles.schedBlock}>
                        <span className={styles.schedTime}>{blockTime(block.start, block.end)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-semibold text-bone [overflow-wrap:anywhere]">{KIND_EMOJI[block.kind]} {block.name}</span>
                          <span className="block text-[12px] text-ink-muted">{!block.travelKnown ? 'Travel time unknown · ' : block.travelMinBefore ? `${block.travelMinBefore} min to get here · ` : ''}{block.reason}</span>
                          <span className="mt-1 flex flex-wrap gap-3 text-[12px]">
                            {item && <a className="underline underline-offset-2" href={item.url} target="_blank" rel="noopener noreferrer"><SourceLogo source={item.source} size={13} className="mr-1" />{item.source} ↗</a>}
                            {MEALS.has(block.kind) && block.kind !== 'breakfast' && item && takesTableSearch(item) && (
                              <a className="underline underline-offset-2" href={openTableSearch({ name: block.name, where: placeName, date: day.date, time: block.start, covers })} target="_blank" rel="noopener noreferrer" title={handoffNote('opentable')}>
                                <SourceLogo source={'opentable'} size={13} className="mr-1" />Find a table on OpenTable ↗
                              </a>
                            )}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              ) : <p className="text-[12px] text-ink-muted">Free day.</p>}
            </div>
          ))}
          {schedule.unscheduled.length > 0 && (
            <div className={styles.schedDay}>
              <h4 className={styles.schedDate}>Didn’t fit</h4>
              <ul className="flex flex-col gap-1 text-[12px] text-ink-muted">
                {schedule.unscheduled.map((entry) => <li key={entry.pickId}>{byId.get(entry.pickId)?.name ?? entry.pickId}: {entry.reason}</li>)}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={styles.miniBtn} onClick={toPicked}>Change pace or picks</button>
          </div>
        </div>
      )}
    </section>
  );
}
