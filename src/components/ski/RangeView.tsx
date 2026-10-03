'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { formatTicket, PRICE_BAND_LABEL, rankResorts, toneFor, type PriceBand, type ResortMatch } from '@/lib/ski/match';
import { useSkiPlan } from '@/lib/ski/store';
import { PASS_LABEL, type Pass } from '@/lib/ski/types';
import { formatSpan } from '@/lib/ski/window';
import { cardColors, Loading, rangeMapStyle, ThumbButton, toneStyle, TripBar, useSkiContext } from './common';
import styles from './ski.module.css';

type Filter = 'all' | Pass | PriceBand;
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'epic', label: 'Epic' },
  { value: 'ikon', label: 'Ikon' },
  { value: 'value', label: PRICE_BAND_LABEL.value },
  { value: 'mid', label: PRICE_BAND_LABEL.mid },
  { value: 'premium', label: PRICE_BAND_LABEL.premium },
];

/** Step two: the resorts in one range, best for you first. */
export function RangeView({ rangeId }: { rangeId: string }) {
  const context = useSkiContext();
  const picks = useSkiPlan((state) => state.picks.resort);
  const togglePick = useSkiPlan((state) => state.togglePick);
  const [filter, setFilter] = useState<Filter>('all');
  const range = context?.data.rangeById.get(rangeId);
  const ranked = useMemo(
    () => (context && range ? rankResorts(context.data.resorts.filter((resort) => resort.rangeId === range.id), context.data.scene, context.window, context.weights) : []),
    [context, range],
  );
  if (!context) return <Loading />;
  if (!range) {
    return (
      <div className={styles.page}><div className={styles.wrap}>
        <header className={styles.head}><Link className={styles.back} href="/ski">← All ranges</Link><h1>We don’t know that range</h1></header>
      </div></div>
    );
  }
  const shown = ranked.filter((match) => filter === 'all' || match.resort.passes.includes(filter as Pass) || match.band === filter);
  const { window } = context;
  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <header className={styles.head}>
          <Link className={styles.back} href="/ski">← All ranges</Link>
        </header>
        <div className={styles.rangeHero} style={rangeMapStyle(range.id, range.colors)} role="img" aria-label={`Map of ${range.name} with its resorts`}>
          <span className={styles.mapCredit}>© OpenStreetMap</span>
        </div>
        <header className={styles.head}>
          <div className={styles.kicker}>{range.where}</div>
          <h1>{range.name}</h1>
          <p className={styles.lead}>{range.summary}. Sorted for {formatSpan(window.from, window.to)}, best for you first.</p>
        </header>
        <div className={styles.filterRow} role="group" aria-label="Filter resorts">
          {FILTERS.map((option) => (
            <button key={option.value} type="button" className={styles.chip} aria-pressed={filter === option.value} onClick={() => setFilter(option.value)}>{option.label}</button>
          ))}
        </div>
        <div className={styles.sectionHead}>
          <h2>{shown.length} resort{shown.length === 1 ? '' : 's'}</h2>
          <p>Swipe, shortlist, tap for the best week</p>
        </div>
        {shown.length ? (
          <div className={styles.rail}>
            {shown.map((match) => (
              <ResortCard key={match.resort.id} match={match} colors={range.colors} on={picks.includes(match.resort.id)} onToggle={() => togglePick('resort', match.resort.id)} />
            ))}
          </div>
        ) : <div className={styles.empty}>No resorts here match that filter.</div>}
      </div>
      <TripBar />
    </div>
  );
}

const VERDICT = { good: 'Prime snow for your dates', season: 'Open for your dates', off: 'Closed for your dates' } as const;

export function ResortCard({ match, colors, on, onToggle }: { match: ResortMatch; colors: [string, string]; on: boolean; onToggle: () => void }) {
  const { resort, tone, forThem, inWindow, band } = match;
  const ticket = formatTicket(resort);
  const highlights = (forThem.length ? forThem : inWindow).slice(0, 3);
  return (
    <article className={styles.card} style={cardColors(colors)} data-tone={toneFor(match.fit)}>
      <Link href={`/ski/resort/${resort.id}`} className={styles.cardLink} aria-label={`Open ${resort.name}`} />
      <div className={styles.cardBody}>
        <div className={styles.cardKicker}>{resort.place}, {resort.region}</div>
        <h3>{resort.name}</h3>
        <span className={styles.verdict} style={toneStyle(tone)}><i />{VERDICT[tone]}</span>
        <p className={styles.cardSummary}>{resort.summary}</p>
        <div className={styles.facts}>
          <span>Lift tickets: <strong>{ticket ? `${ticket} a day` : 'prices not posted yet'}</strong>{band ? ` · ${PRICE_BAND_LABEL[band]}` : ''}</span>
          {resort.passes.length > 0 && (
            <div className={styles.factsRow}>{resort.passes.map((pass) => <span key={pass} className={styles.pill}>{PASS_LABEL[pass]}</span>)}</div>
          )}
          {inWindow.length > 0 ? (
            <>
              <span><strong>{forThem.length || inWindow.length}</strong> {forThem.length ? 'things on you’d like' : 'things on'}</span>
              <ul className={styles.things}>{highlights.map((item) => <li key={item.id}>{item.name}</li>)}</ul>
            </>
          ) : <span>More on what’s around it coming soon</span>}
        </div>
        <div className={styles.cardFoot}>
          <span className={styles.open}>Best week →</span>
          <ThumbButton on={on} onToggle={onToggle} label={resort.name} />
        </div>
      </div>
    </article>
  );
}
