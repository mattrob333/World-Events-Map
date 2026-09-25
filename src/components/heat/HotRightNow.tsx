'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { EventPhoto } from '@/components/discovery/EventPhoto';
import { EVENTS } from '@/lib/data/events';
import { indexDestinations } from '@/lib/pulse';
import type { HeatTicker as Ticker } from '@/lib/heat/types';
import { HeatTicker } from './HeatTicker';
import styles from './heat.module.css';

const BY_ID = new Map(EVENTS.map((event) => [event.id, event]));
const DESTINATIONS = indexDestinations(EVENTS);
const hrefFor = (eventId: string) => {
  const slug = DESTINATIONS.byEventId.get(eventId)?.slug;
  return slug ? `/destinations/${slug}?event=${encodeURIComponent(eventId)}` : `/?event=${encodeURIComponent(eventId)}`;
};
const regionName = typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;

/**
 * What's hot right now: only what made the cut on measured movement, hottest
 * first, with a country filter. Renders nothing until there's something real
 * to show.
 */
export function HotRightNow() {
  const [all, setAll] = useState<Ticker[]>([]);
  const [country, setCountry] = useState<string | null>(null);
  const [byCountry, setByCountry] = useState<Record<string, Ticker[]>>({});

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/heat?limit=20', { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<{ items?: Ticker[] }>) : { items: [] }))
      .then((body) => setAll(Array.isArray(body.items) ? body.items : []))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!country || byCountry[country]) return;
    const controller = new AbortController();
    fetch(`/api/heat?country=${country}&limit=20`, { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<{ items?: Ticker[] }>) : { items: [] }))
      .then((body) => setByCountry((prev) => ({ ...prev, [country]: Array.isArray(body.items) ? body.items : [] })))
      .catch(() => undefined);
    return () => controller.abort();
  }, [country, byCountry]);

  const countries = useMemo(() => [...new Set(all.map((ticker) => ticker.countryCode))], [all]);
  const items = country ? byCountry[country] ?? [] : all;
  if (all.length < 2) return null;

  return (
    <section className={styles.hot} aria-labelledby="hot-title">
      <div className={styles.head}>
        <div>
          <span className={styles.kicker}>▲ HOT RIGHT NOW</span>
          <h2 id="hot-title" className={styles.title}>What the world is into.</h2>
        </div>
        {countries.length > 1 && (
          <div className={styles.countries} role="group" aria-label="Filter by country">
            <button type="button" className="chip" aria-pressed={!country} onClick={() => setCountry(null)}>Everywhere</button>
            {countries.map((code) => (
              <button key={code} type="button" className="chip" aria-pressed={country === code} onClick={() => setCountry(code)}>{regionName?.of(code) ?? code}</button>
            ))}
          </div>
        )}
      </div>
      <div className={styles.rail} role="list">
        {items.map((ticker, index) => {
          const event = BY_ID.get(ticker.subjectId.replace(/^event:/, ''));
          if (!event) return null;
          return (
            <Link key={ticker.subjectId} role="listitem" className={styles.card} href={hrefFor(event.id)}>
              <EventPhoto eventId={event.id} className={styles.photo} />
              <span className={styles.rank}>{index + 1}</span>
              <HeatTicker ticker={ticker} />
              <span className={styles.name}>{event.name}</span>
              <span className={styles.where}>{event.city}, {event.country}</span>
            </Link>
          );
        })}
      </div>
      <p className={styles.note}>Heat is measured: Wikipedia views and news mentions this week against the three before. Each number names its source.</p>
    </section>
  );
}
