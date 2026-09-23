'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { EVENTS } from '@/lib/data/events';
import { isHappeningToday } from '@/lib/data/scene-time';
import { indexDestinations } from '@/lib/pulse';
import styles from './now.module.css';

/**
 * NOW cannot pick venues without its provider. Instead of a form that ends in
 * a disabled button, give the traveler something useful from the curated
 * calendar: what is on today and the destination guide for where they are.
 * No location is requested here.
 */
export function NowUnavailable() {
  const router = useRouter();
  const [now] = useState(() => new Date());
  const { onToday, destinations } = useMemo(() => {
    const index = indexDestinations(EVENTS);
    const today = EVENTS.filter((event) => isHappeningToday(event, now))
      .slice(0, 3)
      .flatMap((event) => {
        const destination = index.byEventId.get(event.id);
        return destination ? [{ event, destination }] : [];
      });
    const all = [...index.pulses].sort((a, b) => a.name.localeCompare(b.name));
    return { onToday: today, destinations: all };
  }, [now]);

  return (
    <section className={styles.unavailable} aria-labelledby="now-unavailable-title">
      <p className={styles.kicker}>NOW · not connected yet</p>
      <h2 id="now-unavailable-title">NOW can&apos;t pick venues tonight.</h2>
      <p>
        Live nearby venue search is awaiting its provider, so there are no recommendations to show.
        Your location is not requested. Here is what the curated calendar can still offer.
      </p>
      {onToday.length > 0 && (
        <div>
          <span className={styles.kicker}>On today</span>
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
        <Link href="/access">Browse ACCESS samples ↗</Link> · <Link href="/">Explore the world calendar ↗</Link>
      </p>
    </section>
  );
}
