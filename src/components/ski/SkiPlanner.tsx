'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { rankRanges, rankResorts, type RangeMatch } from '@/lib/ski/match';
import { useSkiPlan } from '@/lib/ski/store';
import { formatSpan } from '@/lib/ski/window';
import { ResortCard } from './RangeView';
import { Loading, MapCredit, rangeMapStyle, ThumbButton, toneStyle, TripBar, useSkiContext, WindowPicker } from './common';
import styles from './ski.module.css';

/**
 * Step one: when you could go. The mountain ranges come back sorted by how
 * good the snow is for those dates and how much there is around them that
 * fits you. Swipe, shortlist, tap one to see its resorts.
 */
export function SkiPlanner() {
  const context = useSkiContext();
  const picks = useSkiPlan((state) => state.picks.range);
  const resortPicks = useSkiPlan((state) => state.picks.resort);
  const togglePick = useSkiPlan((state) => state.togglePick);
  const ranked = useMemo(
    () => (context ? rankRanges(context.data.ranges, context.data.resorts, context.data.scene, context.window, context.weights) : []),
    [context],
  );
  const best = useMemo(
    () => (context ? rankResorts(context.data.resorts, context.data.scene, context.window, context.weights).filter((match) => match.fit > 0).slice(0, 12) : []),
    [context],
  );
  if (!context) return <Loading />;
  const { window, hasProfile } = context;
  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <header className={styles.head}>
          <div className={styles.kicker}>Plan a ski trip</div>
          <h1>Where’s the best skiing for your dates?</h1>
          <p className={styles.lead}>Pick when you could go. We’ll sort the world’s mountains by snow, then by everything around them you’d love.</p>
        </header>
        <WindowPicker window={window} />
        <p className={styles.taste}>
          {hasProfile
            ? 'Sorted with your Vibe profile: the things you love count most.'
            : <>Sorted by snow and the best of each town. <Link href="/account">Add your Vibe profile</Link> to sort by what you love.</>}
        </p>
        <div className={styles.sectionHead}>
          <h2>Mountain ranges</h2>
          <p>{formatSpan(window.from, window.to)} · {window.nights} nights</p>
        </div>
        <div className={styles.rail}>
          {ranked.map((match) => (
            <RangeCard key={match.range.id} match={match} on={picks.includes(match.range.id)} onToggle={() => togglePick('range', match.range.id)} />
          ))}
        </div>
        {best.length > 0 && (
          <>
            <div className={styles.sectionHead}>
              <h2>Best matches anywhere</h2>
              <p>Most of what you’d love, for your dates</p>
            </div>
            <div className={styles.rail}>
              {best.map((match) => (
                <ResortCard
                  key={match.resort.id}
                  match={match}
                  colors={context.data.rangeById.get(match.resort.rangeId)?.colors ?? ['#1d3b5c', '#4fa3c7']}
                  on={resortPicks.includes(match.resort.id)}
                  onToggle={() => togglePick('resort', match.resort.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <TripBar />
    </div>
  );
}

function RangeCard({ match, on, onToggle }: { match: RangeMatch; on: boolean; onToggle: () => void }) {
  const { range, tone, resorts, forThemCount, verdict } = match;
  const open = resorts.filter((resort) => resort.fit > 0);
  return (
    <article className={styles.card} style={rangeMapStyle(range.id, range.colors)} data-tone={tone} data-map="">
      <Link href={`/ski/${range.id}`} className={styles.cardLink} aria-label={`See resorts in ${range.name}`} />
      <MapCredit />
      <div className={styles.cardBody}>
        <div className={styles.cardTop}>
          <div className={styles.cardKicker}>{range.where}</div>
          <h3>{range.name}</h3>
          <span className={styles.verdict} style={toneStyle(tone)}><i />{verdict}</span>
        </div>
        <div className={styles.mapGap} aria-hidden="true" />
        <p className={styles.cardSummary}>{range.summary}</p>
        <div className={styles.facts}>
          <span><strong>{resorts.length}</strong> resorts{open.length && open.length < resorts.length ? `, ${open.length} open for your dates` : ''}</span>
          {forThemCount > 0 && <span><strong>{forThemCount}</strong> things on you’d like</span>}
          {open.length > 0 && (
            <ul className={styles.things} aria-label="Top resorts for you">
              {open.slice(0, 3).map((resort) => <li key={resort.resort.id}>{resort.resort.name}</li>)}
            </ul>
          )}
        </div>
        <div className={styles.cardFoot}>
          <span className={styles.open}>See resorts →</span>
          <ThumbButton on={on} onToggle={onToggle} label={range.name} />
        </div>
      </div>
    </article>
  );
}
