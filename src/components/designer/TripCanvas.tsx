'use client';

import { useMemo, useState, type DragEvent } from 'react';
import { SLOT_META, searchLinks, type DesignerCard } from '@/lib/designer/catalog';
import { cardLookup, daysUntil, resolveDestination, type Itinerary, type Slot } from '@/lib/designer/itinerary';
import { localIsoDate, tripMoment } from '@/lib/designer/tripNow';
import { useDesignerStore } from '@/lib/designer/store';
import { filterSlot, orderSlot, type SlotFilter, type SortMode, type TripVotes } from '@/lib/designer/votes';
import styles from './designer.module.css';
import { DRAG_MIME, IdeaCard } from './IdeaCard';
import { ScenePlaybook } from './ScenePlaybook';
import { SwipeDeck } from './SwipeDeck';
import { InvitePanel, RightNow, StaysPanel, useNow } from './TripExtras';

function formatDay(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function countdownLabel(days: number): { big: string; small: string } {
  if (days > 1) return { big: `${days} days`, small: 'until wheels up' };
  if (days === 1) return { big: 'Tomorrow', small: 'pack tonight' };
  if (days === 0) return { big: 'Today', small: 'go go go' };
  return { big: 'Underway', small: 'enjoy every minute' };
}

type Drag = { cardId: string; from: string } | null;

export function TripCanvas({ trip, onRestart }: { trip: Itinerary; onRestart: () => void }) {
  const votes = useDesignerStore((state) => state.votes);
  const activeId = useDesignerStore((state) => state.activeParticipant);
  const setActive = useDesignerStore((state) => state.setActiveParticipant);
  const vote = useDesignerStore((state) => state.vote);
  const moveCard = useDesignerStore((state) => state.moveCard);
  const pickCard = useDesignerStore((state) => state.pickCard);
  const [sort, setSort] = useState<SortMode>('curated');
  const [filter, setFilter] = useState<SlotFilter>('all');
  const [drag, setDrag] = useState<Drag>(null);
  const [dropSlot, setDropSlot] = useState<string | null>(null);
  const [swipe, setSwipe] = useState<Slot | null>(null);

  const destination = resolveDestination(trip)!;
  const lookup = useMemo(() => cardLookup(trip), [trip]);
  const now = useNow();
  const live = tripMoment(trip, now) !== null;
  const today = localIsoDate(now);
  const voter = trip.participants.find((person) => person.id === activeId) ?? trip.participants[0];
  const countdown = countdownLabel(daysUntil(trip.startDate));
  const endDate = trip.days[trip.days.length - 1]?.date ?? trip.startDate;

  const moveTargets = useMemo(
    () =>
      trip.days.flatMap((day) =>
        day.slots.map((slot) => ({ id: slot.id, label: `Day ${day.index + 1} · ${slot.label}` })),
      ),
    [trip.days],
  );

  const totals = useMemo(() => {
    let loves = 0;
    for (const slot of Object.values(votes as TripVotes)) for (const card of Object.values(slot)) for (const v of Object.values(card)) if (v === 1) loves += 1;
    return { loves };
  }, [votes]);

  function onDragOver(event: DragEvent<HTMLElement>, slotId: string) {
    if (!drag && !event.dataTransfer.types.includes(DRAG_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (dropSlot !== slotId) setDropSlot(slotId);
  }

  function onDrop(event: DragEvent<HTMLElement>, slot: Slot) {
    event.preventDefault();
    setDropSlot(null);
    let payload = drag;
    try {
      payload = JSON.parse(event.dataTransfer.getData(DRAG_MIME)) as Drag;
    } catch {
      // Fall back to the in-memory drag state.
    }
    if (!payload) return;
    const target = (event.target as HTMLElement).closest('[data-card-index]');
    const index = target ? Number(target.getAttribute('data-card-index')) : slot.cardIds.length;
    moveCard(payload.cardId, payload.from, slot.id, Number.isFinite(index) ? index : 0);
    setDrag(null);
  }

  return (
    <div>
      <header className={styles.hero}>
        {destination.hero ? (
          /* eslint-disable-next-line @next/next/no-img-element -- local editorial file */
          <img className={styles.heroImage} src={destination.hero} alt="" />
        ) : (
          <span className={styles.heroGradient} style={{ ['--a' as string]: destination.palette[0], ['--b' as string]: destination.palette[1] }} aria-hidden />
        )}
        <span className={styles.heroShade} />
        <p className={styles.eyebrow} style={{ color: '#fed7aa' }}>
          {destination.region ? `${destination.region} · ` : ''}{formatDay(trip.startDate)} → {formatDay(endDate)} · {trip.nights} nights
        </p>
        <h1 className="mt-2 font-display text-[clamp(40px,8vw,84px)] leading-[0.95]">{destination.name}</h1>
        <p className="mt-2 max-w-xl text-[15px] opacity-90">{destination.tagline}</p>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className={styles.countdown}>{countdown.big}</p>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] opacity-80">{countdown.small}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`${styles.badge} ${trip.engine === 'claude' ? styles.badgeAi : ''}`}>
              {trip.engine === 'claude' ? 'Curated by Claude' : 'Drafted on this device'}
            </span>
            <span className={styles.badge}>{totals.loves} loves so far</span>
          </div>
        </div>
      </header>

      <RightNow trip={trip} destination={destination} lookup={lookup} now={now} />

      <div className={styles.toolbar} role="toolbar" aria-label="Voting and sorting">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-ink-faint">Voting as</span>
          {trip.participants.map((person) => (
            <button
              key={person.id}
              type="button"
              className={`${styles.traveler} ${person.id === voter?.id ? styles.travelerOn : ''}`}
              onClick={() => setActive(person.id)}
              aria-pressed={person.id === voter?.id}
            >
              <span className={styles.avatar} style={{ background: person.color }}>
                {person.emoji}
              </span>
              {person.name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className={styles.seg} role="group" aria-label="Sort each row">
            {(['curated', 'group'] as SortMode[]).map((mode) => (
              <button key={mode} type="button" className={`${styles.segBtn} ${sort === mode ? styles.segOn : ''}`} onClick={() => setSort(mode)} aria-pressed={sort === mode}>
                {mode === 'curated' ? 'Curated' : 'Group faves'}
              </button>
            ))}
          </div>
          <div className={styles.seg} role="group" aria-label="Filter cards">
            {([
              ['all', 'All'],
              ['loved', 'Loved'],
              ['unvoted', `${voter?.name ?? 'You'}: to vote`],
            ] as [SlotFilter, string][]).map(([value, label]) => (
              <button key={value} type="button" className={`${styles.segBtn} ${filter === value ? styles.segOn : ''}`} onClick={() => setFilter(value)} aria-pressed={filter === value}>
                {label}
              </button>
            ))}
          </div>
          <button type="button" className={styles.miniBtn} onClick={onRestart}>
            New trip
          </button>
        </div>
      </div>
      <p className="mt-3 text-[12px] leading-5 text-ink-faint">
        Drag cards between time slots (or use “Move to…”), tap ★ to make one the pick, and pass the phone around to vote. Votes
        save on this device; tap “Invite people” below to let friends vote on their own phones and send their picks back. Cards are ideas:
        check hours, prices, and bookings with each venue.
      </p>

      {trip.taste?.genres.length ? (
        <ScenePlaybook
          taste={trip.taste}
          initialCity={destination.id === 'maldives' ? 'Male' : destination.name}
          startDate={live ? today : trip.startDate}
          endDate={live ? today : endDate}
          title={live ? `Live music tonight in ${destination.name}` : `Live music for your crew in ${destination.name}`}
          compact
        />
      ) : null}

      {trip.days.map((day) => (
        <section key={day.index} className={styles.day} aria-labelledby={`day-${day.index}`}>
          <div className={styles.dayHead}>
            <span className={styles.dayNum}>
              Day {day.index + 1} · {formatDay(day.date)}
            </span>
            <h2 id={`day-${day.index}`} className={styles.dayTitle}>
              {day.title}
            </h2>
            {day.hype ? <p className={styles.dayHype}>{day.hype}</p> : null}
          </div>
          <div className={styles.timeline}>
            {day.slots.map((slot) => {
              const ordered = filterSlot(orderSlot(slot.cardIds, votes[slot.id], sort), votes[slot.id], filter, voter?.id);
              const cards = ordered.map((id) => lookup(id)).filter((card): card is DesignerCard => Boolean(card));
              const links = searchLinks(destination, slot.kind);
              return (
                <div
                  key={slot.id}
                  className={`${styles.slot} ${dropSlot === slot.id ? styles.slotDrop : ''}`}
                  onDragOver={(event) => onDragOver(event, slot.id)}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropSlot(null);
                  }}
                  onDrop={(event) => onDrop(event, slot)}
                >
                  <span className={styles.slotDot} aria-hidden>
                    {SLOT_META[slot.kind].emoji}
                  </span>
                  <div className={styles.slotHead}>
                    <h3 className={styles.slotLabel}>{slot.label}</h3>
                    <span className={styles.slotTime}>{slot.time}</span>
                    <div className={styles.slotActions}>
                      {slot.cardIds.length > 1 && voter ? (
                        <button type="button" className={styles.miniBtn} onClick={() => setSwipe(slot)}>
                          Swipe ♥
                        </button>
                      ) : null}
                      {links[0] ? (
                        <a className={styles.miniBtn} style={{ display: 'inline-flex', alignItems: 'center' }} href={links[0].href} target="_blank" rel="noopener noreferrer">
                          More ▶
                        </a>
                      ) : null}
                    </div>
                    {slot.note ? <p className={styles.slotNote}>{slot.note}</p> : null}
                  </div>
                  <div className={styles.strip}>
                    {cards.length ? (
                      cards.map((card) => (
                        <IdeaCard
                          key={card.id}
                          card={card}
                          slotId={slot.id}
                          index={slot.cardIds.indexOf(card.id)}
                          lead={slot.cardIds[0] === card.id}
                          votes={votes[slot.id]?.[card.id]}
                          participants={trip.participants}
                          voter={voter}
                          dragging={drag?.cardId === card.id}
                          moveTargets={moveTargets.filter((target) => target.id !== slot.id)}
                          onVote={(value) => voter && vote(slot.id, card.id, voter.id, value)}
                          onPick={() => pickCard(slot.id, card.id)}
                          onMove={(to) => moveCard(card.id, slot.id, to, 0)}
                          onDragStart={() => setDrag({ cardId: card.id, from: slot.id })}
                          onDragEnd={() => {
                            setDrag(null);
                            setDropSlot(null);
                          }}
                        />
                      ))
                    ) : (
                      <div className={styles.stripEmpty}>
                        {slot.cardIds.length ? 'Nothing matches this filter.' : 'Free time. Drag an idea here.'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <StaysPanel trip={trip} destination={destination} />
      <InvitePanel trip={trip} votes={votes} voter={voter} destination={destination} />

      {swipe && voter ? (
        <SwipeDeck
          key={voter.id}
          participants={trip.participants}
          onVoterChange={setActive}
          title={`${swipe.label}, day ${Number(swipe.id.match(/^d(\d+)/)?.[1] ?? 0) + 1}`}
          cards={swipe.cardIds.map((id) => lookup(id)).filter((card): card is DesignerCard => Boolean(card))}
          voter={voter}
          onVote={(cardId, value) => vote(swipe.id, cardId, voter.id, value, false)}
          onPick={(cardId) => pickCard(swipe.id, cardId)}
          onClose={() => setSwipe(null)}
        />
      ) : null}
    </div>
  );
}
