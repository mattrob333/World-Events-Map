'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { SLOT_META } from '@/lib/designer/catalog';
import { cardLookup, groupTags, resolveDestination } from '@/lib/designer/itinerary';
import { placeCards } from '@/lib/designer/place';
import { profileTags } from '@/lib/designer/profile';
import { mergeTastes, tasteFrom } from '@/lib/designer/scene';
import { useDesignerStore } from '@/lib/designer/store';
import { localIsoDate, slotForTime, tripMoment } from '@/lib/designer/tripNow';
import { ScenePlaybook } from '@/components/designer/ScenePlaybook';
import { RightNow, useNow } from '@/components/designer/TripExtras';
import { useHydrated } from '@/components/designer/useHydrated';
import styles from '@/components/designer/designer.module.css';

/**
 * Profile-driven "go here now" ideas for wherever the traveler is. Uses the
 * mood board and trip saved on this device; nothing about them is sent
 * anywhere except the city and music taste for the live-music search.
 * No location is requested: the traveler types the city.
 */
export function NowForYou({ initialCity }: { initialCity?: string }) {
  const hydrated = useHydrated();
  const profiles = useDesignerStore((state) => state.profiles);
  const trip = useDesignerStore((state) => state.trip);
  const now = useNow();
  const destination = trip ? resolveDestination(trip) : undefined;
  const liveTrip = trip && destination && tripMoment(trip, now) ? { trip, destination } : null;
  const tripCity = liveTrip ? (liveTrip.destination.id === 'maldives' ? 'Male' : liveTrip.destination.name) : '';
  const [cityInput, setCityInput] = useState(initialCity ?? '');
  const [chosenCity, setChosenCity] = useState(initialCity ?? '');
  const city = chosenCity || tripCity;

  const profile = profiles[0]?.profile;
  const taste = profile ? mergeTastes([tasteFrom(profile)]) : undefined;
  const slot = slotForTime(now);
  const liveParticipants = liveTrip?.trip.participants;
  const tags = liveParticipants ? groupTags(liveParticipants) : profile ? profileTags(profile) : [];
  const ideas = city
    ? placeCards({ name: city, kind: 'city' }, { tags, foods: profile?.food.slice(0, 3), taste })
        .filter((card) => card.slots.includes(slot))
        .slice(0, 4)
    : [];

  function submit(event: FormEvent) {
    event.preventDefault();
    setChosenCity(cityInput.trim().slice(0, 60));
  }

  if (!hydrated) return null;

  return (
    <section className="mb-8" aria-labelledby="now-for-you-title">
      {liveTrip ? <RightNow trip={liveTrip.trip} destination={liveTrip.destination} lookup={cardLookup(liveTrip.trip)} now={now} nowLink={false} /> : null}
      <div className={styles.panel}>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#f7c548]">
          {SLOT_META[slot].emoji} {SLOT_META[slot].label} · for {profile?.name ?? 'you'}
        </p>
        <h2 id="now-for-you-title" className="mt-1 font-display text-[28px] leading-tight text-ink">
          {city ? (liveTrip ? `More ideas in ${city}` : `Right now in ${city}`) : 'Where are you right now?'}
        </h2>
        <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={submit}>
          <label className={`${styles.label} min-w-0 flex-1`}>
            City
            <input className={styles.input} value={cityInput} maxLength={60} placeholder={tripCity || 'Nashville'} onChange={(e) => setCityInput(e.target.value)} />
          </label>
          <button type="submit" className={styles.ghost} disabled={!cityInput.trim()}>
            Show me
          </button>
        </form>
        {ideas.length ? (
          <div className={styles.stayGrid}>
            {ideas.map((card) => (
              <a key={card.id} className={styles.stayLink} href={card.link?.href} target="_blank" rel="noopener noreferrer">
                <span className="text-[22px]" aria-hidden>
                  {card.emoji}
                </span>
                <span className="text-[15px] font-semibold text-ink">{card.title} ↗</span>
                <span className="text-[12px] text-ink-muted">{card.blurb}</span>
              </a>
            ))}
          </div>
        ) : null}
        {city ? (
          <p className="mt-2 text-[11px] leading-4 text-ink-faint">Each idea opens a live Maps search near {city}, shaped by your board. Check it’s open before you go.</p>
        ) : null}
        {!profile ? (
          <p className="mt-3 text-[13px] text-ink-muted">
            <Link href="/moodboard" className="text-[#fdba74] underline underline-offset-4">
              Make your board
            </Link>{' '}
            and these ideas follow your food, music, and crew.
          </p>
        ) : null}
      </div>
      {city && taste?.genres.length ? (
        <ScenePlaybook key={city} taste={taste} initialCity={city} startDate={localIsoDate(now)} endDate={localIsoDate(now)} title={`Live music tonight in ${city}`} compact />
      ) : null}
    </section>
  );
}

