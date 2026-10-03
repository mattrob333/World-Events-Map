'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { EventPhoto } from '@/components/discovery/EventPhoto';
import { EVENTS } from '@/lib/data/events';
import { formatDateRange } from '@/components/ui/tokens';
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
/** How a country reads in a sentence: "the US", not "United States". */
const SAY: Record<string, string> = { US: 'the US', GB: 'the UK', AE: 'the UAE', NL: 'the Netherlands', PH: 'the Philippines', DO: 'the Dominican Republic', CZ: 'Czechia' };
const regionName = typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;

/**
 * Which cards to show: home's when on National (its trending events, then
 * the rest of its events; everywhere, flagged, only when it has none coming;
 * nothing while it loads), else the picked country's or everywhere's.
 */
export function hotItems({ all, byCountry, home, country }: { all: Ticker[]; byCountry: Record<string, Ticker[]>; home: string | null; country: string | null }): { items: Ticker[]; thinAtHome: boolean } {
  if (home) {
    const atHome = byCountry[home];
    if (atHome === undefined) return { items: [], thinAtHome: false };
    return atHome.length ? { items: atHome, thinAtHome: false } : { items: all, thinAtHome: true };
  }
  return { items: country ? byCountry[country] ?? [] : all, thinAtHome: false };
}

/**
 * What's hot right now: only what made the cut on measured movement, hottest
 * first. With a home country it opens on that country (National) with a
 * switch to Global; Global has a country filter. Renders nothing until
 * there's something real to show.
 */
export function HotRightNow({ home }: { home?: { code: string; name: string } | null }) {
  const [all, setAll] = useState<Ticker[]>([]);
  const [scope, setScope] = useState<'national' | 'global'>('national');
  const [country, setCountry] = useState<string | null>(null);
  const [byCountry, setByCountry] = useState<Record<string, Ticker[]>>({});
  const national = Boolean(home) && scope === 'national';
  const homeSaid = home ? SAY[home.code] ?? home.name : '';

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/heat?limit=20', { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<{ items?: Ticker[] }>) : { items: [] }))
      .then((body) => setAll(Array.isArray(body.items) ? body.items : []))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  // The country being shown: home on National, the picked chip on Global.
  const shown = national ? home!.code : country;
  useEffect(() => {
    const code = shown;
    if (!code || byCountry[code]) return;
    const controller = new AbortController();
    fetch(`/api/heat?country=${code}&limit=20`, { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<{ items?: Ticker[]; more?: Ticker[] }>) : { items: [], more: [] }))
      // What's trending there first, then the rest of its events by measured interest.
      .then((body) => setByCountry((prev) => ({ ...prev, [code]: [...(Array.isArray(body.items) ? body.items : []), ...(Array.isArray(body.more) ? body.more : [])] })))
      .catch(() => undefined);
    return () => controller.abort();
  }, [shown, byCountry]);

  const countries = useMemo(() => [...new Set(all.map((ticker) => ticker.countryCode))], [all]);
  const { items, thinAtHome } = hotItems({ all, byCountry, home: national ? home!.code : null, country });
  if (all.length < 2) return null;

  return (
    <section className={styles.hot} aria-labelledby="hot-title">
      <div className={styles.head}>
        <div>
          <span className={styles.kicker}>▲ HOT RIGHT NOW</span>
          <h2 id="hot-title" className={styles.title}>{national && !thinAtHome ? `What’s hot in ${homeSaid}.` : 'What the world is into.'}</h2>
        </div>
        {home && (
          <div className={styles.countries} role="group" aria-label="National or global">
            <button type="button" className="chip" aria-pressed={scope === 'national'} onClick={() => setScope('national')}>National</button>
            <button type="button" className="chip" aria-pressed={scope === 'global'} onClick={() => setScope('global')}>Global</button>
          </div>
        )}
        {!national && countries.length > 1 && (
          <div className={styles.countries} role="group" aria-label="Filter by country">
            <button type="button" className="chip" aria-pressed={!country} onClick={() => setCountry(null)}>Everywhere</button>
            {countries.map((code) => (
              <button key={code} type="button" className="chip" aria-pressed={country === code} onClick={() => setCountry(code)}>{regionName?.of(code) ?? code}</button>
            ))}
          </div>
        )}
      </div>
      {thinAtHome && <p className={styles.note}>Nothing coming up in {homeSaid} on our calendar yet. Here’s everywhere.</p>}
      <div className={styles.rail} role="list">
        {items.flatMap((ticker) => {
          const event = BY_ID.get(ticker.subjectId.replace(/^event:/, ''));
          return event ? [{ ticker, event }] : [];
        }).map(({ ticker, event }, index) => {
          return (
            <Link key={ticker.subjectId} role="listitem" className={styles.card} href={hrefFor(event.id)}>
              <EventPhoto eventId={event.id} className={styles.photo} />
              {/* Rank and the ticker ride along the top edge, clear of the photo's subject. */}
              <span className={styles.top}>
                <span className={styles.rank}>{index + 1}</span>
                <HeatTicker ticker={ticker} />
              </span>
              <span className={styles.name}>{event.name}</span>
              <span className={styles.where}>{event.city}, {event.country} · {formatDateRange(event.start, event.end)}</span>
            </Link>
          );
        })}
      </div>
      <p className={styles.note}>Heat is measured: Wikipedia views and news mentions this week against the three before. Each number names its source.</p>
    </section>
  );
}
