'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { SLOT_META } from '@/lib/designer/catalog';
import { cardLookup, groupTags, resolveDestination } from '@/lib/designer/itinerary';
import { placeCards } from '@/lib/designer/place';
import { profileTags } from '@/lib/designer/profile';
import { mergeTastes, scenePlaybook, sceneSearchLinks, tasteFrom } from '@/lib/designer/scene';
import { useDesignerStore } from '@/lib/designer/store';
import { isLive, slotKindNow, tripMoment } from '@/lib/designer/tripNow';
import { ScenePlaybook } from '@/components/designer/ScenePlaybook';
import { RightNow, useNow } from '@/components/designer/TripExtras';
import { useHydrated } from '@/components/designer/useHydrated';
import styles from './now.module.css';

/**
 * "Go here now" ideas for wherever the traveler is. Uses the mood board and
 * trip saved on this device; nothing about them is sent anywhere except the
 * city and music taste for the live-music search. No location is requested:
 * the traveler types the city, and it is kept in the URL (?city=).
 */
export function NowForYou({ initialCity, onCity }: { initialCity?: string; onCity?: (city: string) => void }) {
  const hydrated = useHydrated();
  const router = useRouter();
  const profiles = useDesignerStore((state) => state.profiles);
  const trip = useDesignerStore((state) => state.trip);
  const now = useNow();
  const destination = trip ? resolveDestination(trip) : undefined;
  const moment = trip && destination ? tripMoment(trip, now) : null;
  const liveTrip = trip && destination && moment && isLive(moment) ? { trip, destination, moment } : null;
  const tripCity = liveTrip ? (liveTrip.destination.id === 'maldives' ? 'Male' : liveTrip.destination.name) : '';
  const [cityInput, setCityInput] = useState(initialCity ?? '');
  const [chosenCity, setChosenCity] = useState(initialCity ?? '');
  const city = chosenCity || tripCity;
  const inTripCity = Boolean(liveTrip && city.toLowerCase() === tripCity.toLowerCase());

  useEffect(() => {
    if (hydrated) onCity?.(city);
  }, [city, hydrated, onCity]);

  const profile = profiles[0]?.profile;
  // The board's taste first; with no board, the live trip's own taste (the same one the trip page uses).
  const taste = profile ? mergeTastes([tasteFrom(profile)]) : liveTrip?.trip.taste;
  const source: 'board' | 'trip' | undefined = profile ? 'board' : liveTrip ? 'trip' : undefined;
  const slot = slotKindNow(inTripCity ? liveTrip!.moment : null, now, inTripCity ? liveTrip!.destination.kind : 'city');
  const tags = liveTrip ? groupTags(liveTrip.trip.participants) : profile ? profileTags(profile) : [];
  const showPlaybook = Boolean(city && taste?.genres.length);

  // Don't repeat today's plan (shown right above in "Right now"), the live-music
  // panel's own searches (shown right below), or the same link twice.
  const seenTitles = new Set<string>();
  const seenLinks = new Set<string>();
  if (inTripCity && liveTrip) {
    const lookup = cardLookup(liveTrip.trip);
    for (const planned of liveTrip.moment.day.slots) {
      const lead = lookup(planned.cardIds[0]);
      if (lead) seenTitles.add(lead.title.toLowerCase());
      if (lead?.link) seenLinks.add(lead.link.href);
    }
  }
  if (showPlaybook && taste) for (const scene of scenePlaybook(taste)) for (const link of sceneSearchLinks(scene, city)) seenLinks.add(link.href);
  const ideas = city
    ? placeCards({ name: city, kind: 'city' }, { tags, foods: profile?.food.slice(0, 3), taste })
        .filter((card) => card.slots.includes(slot))
        .filter((card) => {
          const href = card.link?.href ?? '';
          if (seenTitles.has(card.title.toLowerCase()) || (href && seenLinks.has(href))) return false;
          seenTitles.add(card.title.toLowerCase());
          if (href) seenLinks.add(href);
          return true;
        })
        .slice(0, 4)
    : [];

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = cityInput.trim().slice(0, 60);
    setChosenCity(next);
    router.replace(next ? `/now?city=${encodeURIComponent(next)}` : '/now', { scroll: false });
  }

  if (!hydrated) return null;

  return (
    <section className={styles.forYouSection} aria-labelledby="now-for-you-title">
      {liveTrip && inTripCity ? <RightNow trip={liveTrip.trip} destination={liveTrip.destination} lookup={cardLookup(liveTrip.trip)} now={now} nowLink={false} /> : null}
      <div className={styles.forYou}>
        <p className={styles.kicker}>
          {SLOT_META[slot].label} · {profile ? `for ${profile.name}` : 'general ideas'}
        </p>
        <h2 id="now-for-you-title">
          {city ? (inTripCity ? `More ideas in ${city}` : `Right now in ${city}`) : 'Where are you right now?'}
        </h2>
        <form className={styles.cityForm} onSubmit={submit}>
          <label className={styles.cityLabel}>
            City
            <input className="field" value={cityInput} maxLength={60} placeholder={tripCity || 'Nashville'} onChange={(e) => setCityInput(e.target.value)} />
          </label>
          <button type="submit" className="btn btn-ghost" disabled={!cityInput.trim()}>
            Show me
          </button>
        </form>
        {ideas.length ? (
          <>
            <p className={styles.ideaLabel}>General Maps searches, not picks</p>
            <div className={styles.ideaGrid}>
              {ideas.map((card) => (
                <a key={card.id} className={styles.ideaLink} href={card.link?.href} target="_blank" rel="noopener noreferrer">
                  <span className="text-[22px]" aria-hidden>
                    {card.emoji}
                  </span>
                  <span className="text-[15px] font-semibold text-ink">{card.title} ↗</span>
                  <span className="text-[13px] text-ink-muted">{card.blurb}</span>
                </a>
              ))}
            </div>
          </>
        ) : null}
        {city ? (
          <p className={styles.forYouFoot}>
            Each idea opens a Maps search for {city}
            {source === 'board' ? ', shaped by your board' : source === 'trip' ? ', shaped by your trip' : ''}. Maps shows what’s there, not what’s open or busy: check before you go.
          </p>
        ) : null}
        {!profile ? (
          <p className={styles.forYouHint}>
            <Link href="/moodboard">Make your board</Link> and these ideas follow your food, music, and crew.
          </p>
        ) : null}
      </div>
      {showPlaybook && taste ? (
        <ScenePlaybook key={city} taste={taste} initialCity={city} startDate={liveTrip && inTripCity ? liveTrip.moment.day.date : localDate(now)} endDate={liveTrip && inTripCity ? liveTrip.moment.day.date : localDate(now)} tonight compact />
      ) : null}
    </section>
  );
}

/** Today's date on this device; before 04:00 it is still last night. */
function localDate(now: Date): string {
  const shifted = now.getHours() < 4 ? new Date(now.getTime() - 4 * 3_600_000) : now;
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}-${String(shifted.getDate()).padStart(2, '0')}`;
}
