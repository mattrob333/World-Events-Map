'use client';

import Link from 'next/link';
import { FEATURES } from '@/lib/flags';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { EVENTS } from '@/lib/data/events';
import { isHappeningToday } from '@/lib/data/scene-time';
import { indexDestinations } from '@/lib/pulse';
import styles from './now.module.css';

/** "Lisbon, Portugal" and "lisbon" name the same city. */
function sameCity(a: string, b: string): boolean {
  const norm = (value: string) => value.split(',')[0].trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return Boolean(a && b) && norm(a) === norm(b);
}

/**
 * NOW cannot pick venues without its provider. The one-line notice above
 * "For you" says so; this block adds what the curated calendar can offer:
 * what is on today in the traveler's city (only there) and the destination
 * guides. No location is requested here.
 */
export function NowUnavailable({ city = '' }: { city?: string }) {
  const router = useRouter();
  const [now] = useState(() => new Date());
  const { onToday, destinations } = useMemo(() => {
    const index = indexDestinations(EVENTS);
    const today = EVENTS.filter((event) => sameCity(event.city, city) && isHappeningToday(event, now))
      .slice(0, 3)
      .flatMap((event) => {
        const destination = index.byEventId.get(event.id);
        return destination ? [{ event, destination }] : [];
      });
    const all = [...index.pulses].sort((a, b) => a.name.localeCompare(b.name));
    return { onToday: today, destinations: all };
  }, [now, city]);

  return (
    <section className={styles.unavailable} aria-labelledby="now-unavailable-title">
      <p className={styles.kicker}>From the world calendar</p>
      <h2 id="now-unavailable-title">More ways in</h2>
      <p>
        NOW can&apos;t pick specific venues yet, so here is what the curated calendar can offer. Your location is not requested.
      </p>
      {onToday.length > 0 && (
        <div>
          <span className={styles.kicker}>On today in {city.split(',')[0]}</span>
          <ul className={styles.unavailableList}>
            {onToday.map(({ event, destination }) => (
              <li key={event.id}>
                <Link href={`/destinations/${destination.slug}?event=${encodeURIComponent(event.id)}`}>
                  {event.name} · {event.city} ↗
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <label className={styles.unavailablePicker}>
        <span className={styles.kicker}>Already somewhere? Open its guide</span>
        <select
          defaultValue=""
          onChange={(event) => {
            if (event.target.value) router.push(`/destinations/${event.target.value}`);
          }}
        >
          <option value="" disabled>Choose a destination</option>
          {destinations.map((destination) => (
            <option key={destination.slug} value={destination.slug}>{destination.name}</option>
          ))}
        </select>
      </label>
      <p className={styles.unavailableLinks}>
        {FEATURES.access ? <><Link href="/access">Browse ACCESS samples ↗</Link> · </> : null}<Link href="/">See what’s hot on the globe ↗</Link>
      </p>
    </section>
  );
}
