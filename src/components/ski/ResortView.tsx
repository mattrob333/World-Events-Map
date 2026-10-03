'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { MONTHS_SHORT } from '@/lib/activity/activities';
import { formatTicket, isForThem, itemInWindow, itemPoints, matchResort, PRICE_BAND_LABEL, rankWeeks } from '@/lib/ski/match';
import { useSkiPlan } from '@/lib/ski/store';
import { PASS_LABEL, SCENE_KIND_LABEL, VIBE_LABEL, type SceneItem } from '@/lib/ski/types';
import { formatDay, formatSpan, monthsLabel, monthWeights } from '@/lib/ski/window';
import { cardColors, Loading, ThumbButton, toneStyle, TripBar, useSkiContext } from './common';
import styles from './ski.module.css';
import { useSkiVoice } from './useSkiVoice';

const VERDICT = { good: 'Prime snow for your dates', season: 'Open for your dates', off: 'Closed for your dates' } as const;
const num = (value: number | null, unit: string) => (value === null ? '–' : `${value.toLocaleString('en-US')}${unit}`);
const monthSpan = (from: number, to: number) => `${MONTHS_SHORT[from - 1]} to ${MONTHS_SHORT[to - 1]}`;

/** Step three: one resort, its best weeks in your window and what's going on around it. */
export function ResortView({ resortId }: { resortId: string }) {
  const context = useSkiContext();
  const picks = useSkiPlan((state) => state.picks);
  const togglePick = useSkiPlan((state) => state.togglePick);
  const resort = context?.data.resortById.get(resortId);
  const match = useMemo(() => (context && resort ? matchResort(resort, context.data.scene, context.window, context.weights) : null), [context, resort]);
  const weeks = useMemo(() => (context && resort ? rankWeeks(resort, context.data.scene, context.window, context.weights).slice(0, 6) : []), [context, resort]);
  useSkiVoice(context, { rangeId: resort?.rangeId });
  if (!context) return <Loading />;
  if (!resort || !match) {
    return (
      <div className={styles.page}><div className={styles.wrap}>
        <header className={styles.head}><Link className={styles.back} href="/ski">← All ranges</Link><h1>We don’t know that resort</h1></header>
      </div></div>
    );
  }
  const { window, weights, data } = context;
  const range = data.rangeById.get(resort.rangeId);
  const months = monthWeights(window.from, window.to);
  const items = data.scene.filter((item) => item.resortId === resort.id);
  const byPoints = (a: SceneItem, b: SceneItem) => itemPoints(b, weights) - itemPoints(a, weights) || a.name.localeCompare(b.name);
  const during = items.filter((item) => itemInWindow(item, window, months)).sort(byPoints);
  const other = items.filter((item) => !itemInWindow(item, window, months)).sort(byPoints);
  const ticket = formatTicket(resort);
  const bestScore = weeks[0]?.score;

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <header className={styles.head}>
          <Link className={styles.back} href={range ? `/ski/${range.id}` : '/ski'}>← {range?.name ?? 'All ranges'}</Link>
        </header>
        <section className={styles.hero} style={cardColors(range?.colors ?? ['#1d3b5c', '#4fa3c7'])}>
          <div className={styles.cardKicker}>{resort.place}, {resort.region}, {resort.country}</div>
          <h1>{resort.name}</h1>
          <p className={styles.cardSummary} style={{ marginTop: 8 }}>{resort.summary}</p>
          <div className={styles.heroActions}>
            <span className={styles.verdict} style={toneStyle(match.tone)}><i />{VERDICT[match.tone]}</span>
            {resort.vibe.map((vibe) => <span key={vibe} className={styles.pill}>{VIBE_LABEL[vibe]}</span>)}
          </div>
          <div className={styles.heroActions}>
            <ThumbButton on={picks.resort.includes(resort.id)} onToggle={() => togglePick('resort', resort.id)} label={resort.name} />
          </div>
        </section>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <small>Lift tickets, adult day</small>
            <strong>{ticket ?? 'Not posted yet'}</strong>
            {resort.liftTicket && <span>{resort.liftTicket.season} season{match.band ? ` · ${PRICE_BAND_LABEL[match.band]}` : ''}</span>}
          </div>
          <div className={styles.stat}>
            <small>Passes</small>
            <strong>{resort.passes.length ? resort.passes.map((pass) => PASS_LABEL[pass]).join(', ') : 'None'}</strong>
          </div>
          <div className={styles.stat}>
            <small>Season</small>
            <strong>{resort.season.dates?.close ? formatSpan(resort.season.dates.open, resort.season.dates.close) : monthSpan(resort.season.opensMonth, resort.season.closesMonth)}</strong>
            <span>{resort.season.dates && !resort.season.dates.close ? `Opens ${formatDay(resort.season.dates.open)} · ` : ''}Best {monthsLabel(resort.bestMonths)}</span>
          </div>
          <div className={styles.stat}><small>Top</small><strong>{num(resort.topFt, ' ft')}</strong><span>{num(resort.verticalFt, ' ft')} vertical</span></div>
          <div className={styles.stat}><small>Terrain</small><strong>{num(resort.skiableAcres, ' acres')}</strong><span>{resort.trails ? `${resort.trails} runs` : ''}</span></div>
          {resort.nearestAirports.length > 0 && (
            <div className={styles.stat}>
              <small>Fly into</small>
              <strong>{resort.nearestAirports.map((airport) => airport.iata).join(', ')}</strong>
              <span>{resort.nearestAirports.map((airport) => `${airport.city}${airport.driveTime ? ` ${airport.driveTime}` : ''}`).join(' · ')}</span>
            </div>
          )}
        </div>
        {resort.liftTicket?.note && <p className={styles.note} style={{ marginTop: 8 }}>{resort.liftTicket.note}.</p>}

        <section className={styles.block}>
          <h2>Why go</h2>
          <p className={styles.why}>{resort.why}</p>
        </section>

        <section className={styles.block}>
          <h2>Your best weeks</h2>
          {!weeks.length && <div className={styles.empty}>Your dates are shorter than {window.nights} nights. Widen them or pick fewer nights to see weeks.</div>}
          <div className={styles.weeks}>
            {weeks.map((week) => {
              const key = `${resort.id}@${week.start}`;
              return (
                <div key={week.start} className={styles.week} data-best={week.score === bestScore && week.score > 0 ? '' : undefined}>
                  <strong>{week.label}</strong>
                  <ThumbButton small on={picks.week.includes(key)} onToggle={() => togglePick('week', key)} label={`${resort.name}, ${week.label}`} />
                  <p>{week.reasons.join(' · ') || 'In season'}</p>
                </div>
              );
            })}
          </div>
          <p className={styles.note} style={{ marginTop: 8 }}>Weeks start on a Saturday. Busy holiday weeks are marked so you can avoid or plan for them.</p>
        </section>

        <section className={styles.block}>
          <h2>On during your dates</h2>
          {during.length ? <Scene items={during} picks={picks.scene} togglePick={(id) => togglePick('scene', id)} forThem={(item) => isForThem(item, weights)} />
            : <div className={styles.empty}>We haven’t found anything on here for your dates yet. The mountain is the main event.</div>}
        </section>

        {other.length > 0 && (
          <section className={styles.block}>
            <h2>Other times of year</h2>
            <Scene items={other} picks={picks.scene} togglePick={(id) => togglePick('scene', id)} forThem={() => false} />
          </section>
        )}

        <section className={styles.block}>
          <h2>Links</h2>
          <div className={styles.links}>
            <a className={styles.linkBtn} href={resort.links.officialSite} target="_blank" rel="noopener noreferrer">Official site</a>
            {(resort.links.tickets ?? resort.liftTicket?.sourceUrl) && <a className={styles.linkBtn} href={resort.links.tickets ?? resort.liftTicket?.sourceUrl} target="_blank" rel="noopener noreferrer">Lift tickets</a>}
            {resort.family?.skiSchool && <a className={styles.linkBtn} href={resort.family.skiSchool} target="_blank" rel="noopener noreferrer">Ski school</a>}
            {resort.links.instagram && <a className={styles.linkBtn} href={resort.links.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>}
          </div>
          {resort.liftTicket && (
            <p className={styles.note} style={{ marginTop: 10 }}>
              Lift prices change by date and are cheapest online ahead of time. This range was read from <a href={resort.liftTicket.sourceUrl} target="_blank" rel="noopener noreferrer">this page</a> on {resort.liftTicket.checkedOn}. Check before you buy.
            </p>
          )}
        </section>
      </div>
      <TripBar />
    </div>
  );
}

function Scene({ items, picks, togglePick, forThem }: { items: SceneItem[]; picks: string[]; togglePick: (id: string) => void; forThem: (item: SceneItem) => boolean }) {
  return (
    <div className={styles.scene}>
      {items.map((item) => (
        <div key={item.id} className={styles.item} data-for-you={forThem(item) ? '' : undefined}>
          <span className={styles.itemKind}>{SCENE_KIND_LABEL[item.kind]}{item.wow === 3 ? ' · Iconic' : ''}{forThem(item) ? ' · For you' : ''}</span>
          <ThumbButton small on={picks.includes(item.id)} onToggle={() => togglePick(item.id)} label={item.name} />
          <strong>{item.name}</strong>
          <p>{item.summary}</p>
          <small>{item.dates ? formatSpan(item.dates.start, item.dates.end) : item.datesNote ?? (item.months.length >= 12 ? 'Open year-round' : `Open ${monthsLabel(item.months)}`)}</small>
          {(item.links.officialSite || item.links.instagram) && (
            <div className={styles.itemLinks}>
              {item.links.officialSite && <a href={item.links.officialSite} target="_blank" rel="noopener noreferrer">Website</a>}
              {item.links.instagram && <a href={item.links.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
