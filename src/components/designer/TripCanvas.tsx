'use client';

import { useMemo, useState, type DragEvent } from 'react';
import { SLOT_META, searchLinks, type DesignerCard } from '@/lib/designer/catalog';
import { cardLookup, daysUntil, resolveDestination, type Itinerary, type Slot } from '@/lib/designer/itinerary';
import { isLive, tripMoment, type TripMoment } from '@/lib/designer/tripNow';
import { useDesignerStore } from '@/lib/designer/store';
import { filterSlot, orderSlot, type SlotFilter, type SortMode, type TripVotes } from '@/lib/designer/votes';
import styles from './designer.module.css';
import { DestinationResearch } from './DestinationResearch';
import { DRAG_MIME, IdeaCard } from './IdeaCard';
import { ScenePlaybook } from './ScenePlaybook';
import { SwipeDeck } from './SwipeDeck';
import { GuestBar, InvitePanel, RightNow, StaysPanel, useNow, usePicksSender } from './TripExtras';
import { photoImageProps } from '@/lib/place-media/sources';

function formatDay(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function countdownLabel(days: number, moment: TripMoment, place: string, totalDays: number): { big: string; small: string } {
  if (moment.phase === 'after') return { big: `That was ${place}`, small: moment.daysAgo === 1 ? '1 day ago' : `${moment.daysAgo} days ago` };
  if (moment.phase === 'travel-out') return { big: 'Today', small: 'travel day · go go go' };
  if (moment.phase === 'travel-home') return { big: 'Last day', small: 'safe travels home' };
  if (moment.phase === 'on-ground') return { big: `Day ${moment.day.index + 1} of ${totalDays}`, small: 'enjoy every minute' };
  if (days > 1) return { big: `${days} days`, small: 'until wheels up' };
  if (days === 1) return { big: 'Tomorrow', small: 'pack tonight' };
  return { big: 'Today', small: 'go go go' };
}

type Drag = { cardId: string; from: string } | null;

export function TripCanvas({ trip, onRestart }: { trip: Itinerary; onRestart: () => void }) {
  const votes = useDesignerStore((state) => state.votes);
  const activeId = useDesignerStore((state) => state.activeParticipant);
  const setActive = useDesignerStore((state) => state.setActiveParticipant);
  const vote = useDesignerStore((state) => state.vote);
  const moveCard = useDesignerStore((state) => state.moveCard);
  const pickCard = useDesignerStore((state) => state.pickCard);
  const joinedAs = useDesignerStore((state) => state.joinedAs);
  const previousTrip = useDesignerStore((state) => state.previousTrip);
  const restorePreviousTrip = useDesignerStore((state) => state.restorePreviousTrip);
  // Guest copies vote as the joined identity; "pass the phone" is an explicit, warned escape.
  const [passPhone, setPassPhone] = useState(false);
  const [sort, setSort] = useState<SortMode>('curated');
  const [filter, setFilter] = useState<SlotFilter>('all');
  const [drag, setDrag] = useState<Drag>(null);
  const [dropSlot, setDropSlot] = useState<string | null>(null);
  const [swipe, setSwipe] = useState<Slot | null>(null);

  const destination = resolveDestination(trip)!;
  const lookup = useMemo(() => cardLookup(trip), [trip]);
  const now = useNow();
  const moment = tripMoment(trip, now);
  const live = isLive(moment);
  const over = moment.phase === 'after';
  // The trip day, not the calendar date: at 01:30 tonight is still yesterday's night out.
  const today = live ? moment.day.date : trip.startDate;
  const guest = trip.joinedFrom !== undefined;
  const organizerName = trip.joinedFrom || 'the organizer';
  const me = guest ? trip.participants.find((person) => person.id === (joinedAs ?? activeId)) : undefined;
  const active = trip.participants.find((person) => person.id === activeId) ?? trip.participants[0];
  const voter = me && !passPhone ? me : active;
  // On a guest copy the organizer is never a voting choice: their votes live on their own device.
  const voters = guest ? trip.participants.filter((person, index) => index > 0 || person.id === me?.id) : trip.participants;
  const picks = usePicksSender(trip, votes, me, destination);
  const setAside = previousTrip && previousTrip.trip.id !== trip.id ? resolveDestination(previousTrip.trip)?.name ?? 'other' : null;
  const countdown = countdownLabel(daysUntil(trip.startDate), moment, destination.name, trip.days.length);
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
          <img className={styles.heroImage} {...photoImageProps({ imageUrl: destination.hero }, 'hero')} alt="" decoding="async" />
        ) : (
          <span className={styles.heroGradient} style={{ ['--a' as string]: destination.palette[0], ['--b' as string]: destination.palette[1] }} aria-hidden />
        )}
        <span className={styles.heroShade} />
        <p className={`${styles.eyebrow} ${styles.heroEyebrow}`}>
          {destination.region ? `${destination.region} · ` : ''}{formatDay(trip.startDate)} → {formatDay(endDate)} · {trip.nights} nights
        </p>
        <h1 className="mt-2 font-display text-[clamp(40px,8vw,84px)] leading-[0.95]">{destination.name}</h1>
        <p className="mt-2 max-w-xl text-[15px] opacity-90">{destination.tagline}</p>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className={styles.countdown} style={over ? { fontSize: 'clamp(34px, 7vw, 64px)' } : undefined}>
              {countdown.big}
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-90">{countdown.small}</p>
            {over ? (
              <button type="button" className={`${styles.cta} mt-3`} onClick={onRestart}>
                Plan the next one
              </button>
            ) : null}
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
          <span className="text-[12px] text-ink-subtle">Voting as</span>
          {(me && !passPhone ? [me] : voters).map((person) => (
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
          {me ? (
            passPhone ? (
              <button
                type="button"
                className={styles.miniBtn}
                onClick={() => {
                  setActive(me.id);
                  setPassPhone(false);
                }}
              >
                Back to {me.name}
              </button>
            ) : (
              <button type="button" className={styles.miniBtn} onClick={() => setPassPhone(true)}>
                Someone else voting? (pass the phone)
              </button>
            )
          ) : null}
          {me && passPhone ? (
            <p className="w-full text-[12px] leading-5 text-ink-muted" role="note">
              Votes made as someone else stay on this phone. Only {me.name}’s picks go to {organizerName}; everyone else can send their own from their phone.
            </p>
          ) : null}
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
        </div>
      </div>
      <p className="mt-3 text-[12px] leading-5 text-ink-subtle">
        {guest
          ? `Tap 👍 on what you’re into and 👎 on what you’d skip. Your votes stay on this phone until you tap “Send to ${trip.joinedFrom || 'organizer'}”. Cards are ideas: check hours, prices, and bookings with each venue.`
          : 'Drag cards between time slots (or use “Move to…”), tap ★ to make one the pick, and pass the phone around to vote. Votes save on this device; tap “Invite people” below to let friends vote on their own phones and send their picks back. Cards are ideas: check hours, prices, and bookings with each venue.'}
      </p>
      {/* Clearing the trip is not a filter: a quiet text action, away from the toggles (UFR2-J12). */}
      <div className="flex justify-end">
        <button type="button" className={styles.restartLink} onClick={onRestart}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7" /><path d="M4 4v4.5h4.5" /></svg>
          Start a new trip
        </button>
      </div>
      {setAside ? (
        <div className={`${styles.row} mt-3`}>
          <p className="text-[12px] leading-5 text-ink-muted">Your {setAside} trip is set aside on this device.</p>
          <button type="button" className={styles.miniBtn} onClick={restorePreviousTrip}>
            Restore my {setAside} trip
          </button>
        </div>
      ) : null}

      <DestinationResearch trip={trip} destination={destination} />

      {trip.taste?.genres.length ? (
        <ScenePlaybook
          taste={trip.taste}
          initialCity={destination.id === 'maldives' ? 'Male' : destination.name}
          startDate={over ? undefined : live ? today : trip.startDate}
          endDate={over ? undefined : live ? today : endDate}
          tonight={live}
          title={`Live music for your crew in ${destination.name}`}
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
      <InvitePanel trip={trip} votes={votes} voter={guest ? me : voter} destination={destination} picks={guest ? picks : undefined} />
      {me ? (
        <>
          <GuestBar picks={picks} />
          {/* Room under the last panel so the fixed phone bar never covers it. */}
          <div className="h-24 md:hidden" aria-hidden />
        </>
      ) : null}

      {swipe && voter ? (
        <SwipeDeck
          key={voter.id}
          participants={me && !passPhone ? [me] : voters}
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
