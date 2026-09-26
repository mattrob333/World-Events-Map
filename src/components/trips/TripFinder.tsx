'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { EVENTS } from '@/lib/data/events';
import { orderShortlistEvents, selectSeasonalEvents, type TripInterest, type TripSeason } from '@/lib/discovery/seasonal';
import { shortDate } from '@/lib/discovery/whyNow';
import { planTripHref } from '@/lib/search/planPlace';
import styles from '@/components/discovery/world-intro.module.css';

export const SEASONS: { value: TripSeason; label: string; defaultInterest: TripInterest }[] = [
  { value: 'all', label: 'Every season', defaultInterest: 'all' },
  { value: 'winter', label: 'Winter', defaultInterest: 'ski' },
  { value: 'spring', label: 'Spring', defaultInterest: 'adventure' },
  { value: 'summer', label: 'Summer', defaultInterest: 'coast' },
  { value: 'fall', label: 'Fall', defaultInterest: 'culture' },
];

export const INTERESTS: { value: TripInterest; label: string }[] = [
  { value: 'all', label: 'Anything' },
  { value: 'ski', label: 'Ski & snow' },
  { value: 'coast', label: 'Coast & water' },
  { value: 'adventure', label: 'Nature & adventure' },
  { value: 'culture', label: 'Culture & food' },
];

const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/**
 * "What kind of trip calls to you?": a season and a feeling, then the dated
 * occasions on the curated calendar that fit, each one tap from the designer.
 */
export function TripFinder({ onFamilySki }: { onFamilySki?: () => void }) {
  const [season, setSeason] = useState<TripSeason>('all');
  const [interest, setInterest] = useState<TripInterest>('all');
  const today = useMemo(() => localToday(), []);
  const matches = useMemo(
    () => (season === 'all' && interest === 'all' ? [] : orderShortlistEvents(selectSeasonalEvents(EVENTS, today, season, interest), interest).slice(0, 6)),
    [season, interest, today],
  );
  const familySki = season === 'winter' && interest === 'ski';

  return (
    <section className={styles.tripFinder} aria-labelledby="trip-finder-title">
      <div className={styles.finderIntro}>
        <div>
          <h2 id="trip-finder-title">What kind of trip calls to you?</h2>
          <p>Choose when and what you love. The dates that fit follow.</p>
        </div>
      </div>
      <div className={styles.finderControls}>
        <fieldset className={styles.finderGroup}>
          <legend>When</legend>
          <div>{SEASONS.map((option) => <button key={option.value} type="button" className="chip" aria-pressed={season === option.value} onClick={() => { setSeason(option.value); setInterest(option.defaultInterest); }}>{option.label}</button>)}</div>
        </fieldset>
        <fieldset className={styles.finderGroup}>
          <legend>What</legend>
          <div>{INTERESTS.map((option) => <button key={option.value} type="button" className="chip" aria-pressed={interest === option.value} onClick={() => setInterest(option.value)}>{option.label}</button>)}</div>
        </fieldset>
      </div>
      {matches.length > 0 && (
        <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Dates that fit">
          {matches.map((event) => (
            <li key={event.id}>
              <Link
                href={planTripHref({ place: event.city, region: event.country, start: event.start >= today ? event.start : undefined })}
                className="flex min-h-11 flex-col rounded-2xl border border-white/[0.08] bg-surface-1 px-4 py-3 hover:border-saffron/50"
              >
                <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-saffron">{shortDate(event.start)}</span>
                <span className="font-display text-[20px] leading-tight text-bone">{event.city}</span>
                <span className="truncate text-[13px] text-ink-muted">{event.name}</span>
                <span className="mt-1 text-[13px] font-semibold text-saffron">Plan this →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {season !== 'all' || interest !== 'all' ? matches.length === 0 && <p className="mt-6 text-[14px] text-ink-muted">Nothing on the calendar fits that yet. Try another season or feeling.</p> : null}
      {familySki && onFamilySki && (
        <button type="button" className={`${styles.finderLink} mt-4`} onClick={onFamilySki}>
          Start a family ski trip <span aria-hidden="true">↗</span>
        </button>
      )}
      {interest === 'ski' && <div className={styles.snowOutlook} role="note">
        <div><span>SNOW OUTLOOK</span><strong>Plan the week. Check the mountain.</strong></div>
        <p>These are curated ski dates, not a snow report. Snow depth, recent snowfall, forecast, open lifts, and family terrain still need a verified resort or weather source before you decide where conditions are best.</p>
        <span className={`tag ${styles.snowStatus}`}>LIVE SNOW REPORTS · NOT CONNECTED YET</span>
        <div className={styles.snowLinks} aria-label="Official mountain condition reports">
          <span>CHECK OFFICIAL REPORTS</span>
          <a href="https://www.aspensnowmass.com/four-mountains/aspen-mountain/snow-and-grooming-report" target="_blank" rel="noopener noreferrer">Aspen Snowmass</a>
          <a href="https://www.engadin.ch/en/reports/snowsports-report" target="_blank" rel="noopener noreferrer">St. Moritz / Engadin</a>
          <a href="https://verbier4vallees.ch/en/useful-information/live-information-winter" target="_blank" rel="noopener noreferrer">Verbier</a>
          <a href="https://zermatt.swiss/en/info/weather/snow-report" target="_blank" rel="noopener noreferrer">Zermatt</a>
        </div>
      </div>}
    </section>
  );
}
