'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { handoffNote, openTableSearch } from '@/lib/booking/partners';
import { basketItems, fitCandidates, profileLikes, schedulePicks, type BasketItem } from '@/lib/designer/basket';
import type { Itinerary } from '@/lib/designer/itinerary';
import { buildSchedule, type ScheduleInput, type ScheduleResult } from '@/lib/designer/schedule';
import { pickActiveProfile, useDesignerStore } from '@/lib/designer/store';
import type { DestinationResearch } from '@/lib/research/destinationSources';
import styles from './designer.module.css';

type Ranked = BasketItem & { band: 'standout' | 'good' | 'fine' | 'skip' | null; because: string | null };
type Phase = 'idle' | 'ranking' | 'deck' | 'picked' | 'schedule';

const BAND_LABEL = { standout: 'Standout for you', good: 'Good fit', fine: 'Could work', skip: 'Probably not you' } as const;
const KIND_EMOJI: Record<string, string> = { breakfast: '☕', lunch: '🍽️', dinner: '🍷', drinks: '🍸', nightlife: '🪩', sight: '📍', activity: '🏄', event: '🎟️' };
const MEALS = new Set(['breakfast', 'lunch', 'dinner']);

function storageKey(tripId: string) {
  return `dope.basket.v1:${tripId}`;
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
  const [drag, setDrag] = useState(0);
  const dragStart = useRef<number | null>(null);

  // Keeps from an earlier visit on this device come back with the trip.
  useEffect(() => {
    let saved: string[] = [];
    try { saved = JSON.parse(window.localStorage.getItem(storageKey(trip.id)) ?? '[]'); } catch { /* storage off */ }
    if (!Array.isArray(saved) || !saved.length) return;
    const valid = saved.filter((id): id is string => typeof id === 'string' && items.some((item) => item.id === id));
    if (!valid.length) return;
    const timer = window.setTimeout(() => {
      setKept(valid);
      setRanked(items.map((item) => ({ ...item, band: null, because: null })));
      setPhase('picked');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [trip.id, items]);

  const saveKept = (next: string[]) => {
    setKept(next);
    try { window.localStorage.setItem(storageKey(trip.id), JSON.stringify(next)); } catch { /* in-memory still works */ }
  };

  const rank = async () => {
    setPhase('ranking');
    setError('');
    const crew = trip.participants.map((person) => (person.kind === 'kid' && person.age !== undefined ? `${person.name} (${person.age})` : person.name)).join(', ');
    try {
      const response = await fetch('/api/designer/basket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip: { place: placeName, when: `${trip.startDate}, ${trip.nights} nights`, crew },
          traveler: { words: profile?.summary ?? '', likes: profileLikes(profile) },
          candidates: fitCandidates(items),
        }),
      });
      const body = (await response.json()) as { ranked?: { id: string; band: Ranked['band']; because: string | null }[]; rankedBy?: 'fit' | 'rating'; error?: string };
      if (!response.ok || !body.ranked) throw new Error(body.error ?? 'Couldn’t rank these right now.');
      const byId = new Map(items.map((item) => [item.id, item]));
      setRanked(body.ranked.flatMap((entry) => {
        const item = byId.get(entry.id);
        return item ? [{ ...item, band: entry.band, because: entry.because }] : [];
      }));
      setRankedBy(body.rankedBy ?? null);
      setIndex(0);
      saveKept([]);
      setPhase('deck');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Couldn’t rank these right now.');
      setPhase('idle');
    }
  };

  const current = ranked[index];
  const decide = (keep: boolean) => {
    if (!current) return;
    if (keep) saveKept([...kept.filter((id) => id !== current.id), current.id]);
    setDrag(0);
    if (index + 1 >= ranked.length) setPhase('picked');
    else setIndex(index + 1);
  };

  useEffect(() => {
    if (phase !== 'deck') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === 'ArrowRight') decide(true);
      if (event.key === 'ArrowLeft') decide(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const keptItems = ranked.filter((item) => kept.includes(item.id)).sort((a, b) => kept.indexOf(a.id) - kept.indexOf(b.id));
  const fit = () => {
    setSchedule(buildSchedule({ startDate: trip.startDate, days: Math.max(1, Math.min(14, trip.nights)), picks: schedulePicks(keptItems), pace }));
    setPhase('schedule');
  };
  const covers = Math.max(1, trip.participants.length);
  const byId = new Map(ranked.map((item) => [item.id, item]));

  if (items.length < 2) return null;

  return (
    <section className={styles.basket} aria-label="Your picks">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className={styles.basketTitle}>Pick your winners</h3>
        {phase !== 'idle' && phase !== 'ranking' && (
          <button type="button" className={styles.miniBtn} onClick={() => void rank()}>Start over</button>
        )}
      </div>

      {phase === 'idle' && (
        <div className={styles.researchStart}>
          <p className="text-[13px] leading-5 text-ink-soft">
            {items.length} real places from this look-around. We’ll rank them for {profile ? 'you and this trip' : 'this trip'}, you keep the winners, and we fit them into your days.
          </p>
          <button type="button" className={styles.ghost} onClick={() => void rank()}>Rank for my crew</button>
          {error && <p className={styles.error} role="alert">{error}</p>}
        </div>
      )}

      {phase === 'ranking' && <p className={styles.researchStatus} role="status">Ranking {items.length} places for {profile ? 'you' : 'this trip'}…</p>}

      {phase === 'deck' && current && (
        <div className={styles.deck}>
          <p className="text-[12px] text-ink-muted" aria-live="polite">
            {index + 1} of {ranked.length} · {kept.length} kept{rankedBy === 'rating' ? ' · ranked by rating (fit check unavailable)' : ''}
          </p>
          <article
            className={styles.deckCard}
            style={{ transform: `translateX(${drag}px) rotate(${drag / 30}deg)` }}
            onPointerDown={(event) => { dragStart.current = event.clientX; (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId); }}
            onPointerMove={(event) => { if (dragStart.current !== null) setDrag(event.clientX - dragStart.current); }}
            onPointerUp={() => {
              const moved = drag;
              dragStart.current = null;
              if (moved > 90) decide(true);
              else if (moved < -90) decide(false);
              else setDrag(0);
            }}
          >
            {current.image?.url ? (
              // Provider CDN image of this listing, as returned with it.
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.deckPhoto} src={current.image.url} alt={current.image.alt} referrerPolicy="no-referrer" draggable={false} />
            ) : <div className={styles.deckPhoto} aria-hidden="true">{KIND_EMOJI[current.kind]}</div>}
            <div className={styles.deckBody}>
              {current.band && <span className={styles.bandChip} data-band={current.band}>{BAND_LABEL[current.band]}</span>}
              <h4 className={styles.deckName}>{current.name}</h4>
              <p className={styles.researchMeta}>
                {current.rating !== undefined ? `★ ${current.rating.toFixed(1)}` : ''}{current.category ? ` · ${current.category}` : ''}{current.price ? ` · ${current.price}` : ''}
              </p>
              {current.because && <p className={styles.deckBecause}>{current.because}</p>}
              {current.snippet && <p className={styles.researchSnippet}>“{current.snippet}”</p>}
              <a className={styles.researchSource} href={current.url} target="_blank" rel="noopener noreferrer">{current.source} ↗</a>
            </div>
          </article>
          <div className={styles.deckActions}>
            <button type="button" className={styles.deckPass} onClick={() => decide(false)} aria-label={`Pass on ${current.name}`}>Pass</button>
            <button type="button" className={styles.deckDone} onClick={() => setPhase('picked')}>Done choosing</button>
            <button type="button" className={styles.deckKeep} onClick={() => decide(true)} aria-label={`Keep ${current.name}`}>Keep ♥</button>
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
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-ink-muted">Pace</span>
            {(['easy', 'balanced', 'packed'] as const).map((value) => (
              <button key={value} type="button" className={`${styles.segBtn} ${pace === value ? styles.segOn : ''}`} onClick={() => setPace(value)}>{value[0]!.toUpperCase() + value.slice(1)}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={styles.ghost} disabled={!keptItems.length} onClick={fit}>Fit {keptItems.length} into my days</button>
            {index + 1 < ranked.length && <button type="button" className={styles.miniBtn} onClick={() => setPhase('deck')}>Keep choosing</button>}
          </div>
        </div>
      )}

      {phase === 'schedule' && schedule && (
        <div className="mt-3 flex flex-col gap-4">
          <p className="text-[12px] leading-4 text-ink-subtle">
            Placed {schedule.score.placed} of {schedule.score.total}, about {schedule.score.travelMin} minutes of getting around. Opening hours aren’t known for most places, so typical hours are assumed; check each place before you go.
          </p>
          {schedule.days.map((day) => (
            <div key={day.date} className={styles.schedDay}>
              <h4 className={styles.schedDate}>{shortDay(day.date)}</h4>
              {day.blocks.length ? (
                <ol className="flex flex-col gap-2">
                  {day.blocks.map((block) => {
                    const item = byId.get(block.pickId);
                    return (
                      <li key={block.pickId} className={styles.schedBlock}>
                        <span className={styles.schedTime}>{block.start}–{block.end}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-semibold text-bone">{KIND_EMOJI[block.kind]} {block.name}</span>
                          <span className="block text-[12px] text-ink-muted">{block.travelMinBefore ? `${block.travelMinBefore} min to get here · ` : ''}{block.reason}</span>
                          <span className="mt-1 flex flex-wrap gap-3 text-[12px]">
                            {item && <a className="underline underline-offset-2" href={item.url} target="_blank" rel="noopener noreferrer">{item.source} ↗</a>}
                            {MEALS.has(block.kind) && (
                              <a className="underline underline-offset-2" href={openTableSearch({ name: block.name, where: placeName, date: day.date, time: block.start, covers })} target="_blank" rel="noopener noreferrer" title={handoffNote('opentable')}>
                                Reserve on OpenTable ↗
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
            <button type="button" className={styles.miniBtn} onClick={() => setPhase('picked')}>Change pace or picks</button>
          </div>
        </div>
      )}
    </section>
  );
}
