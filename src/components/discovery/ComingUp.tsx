'use client';

import { useMemo, useRef } from 'react';
import { addDays, daysBetween } from '@/lib/buzz/dates';
import { buildLanes, COMING_UP_DAYS as DAYS, packRows, planWord, shortName } from '@/lib/discovery/comingUp';
import { shortDate } from '@/lib/discovery/whyNow';
import type { WorldEvent } from '@/lib/types';
import styles from './coming-up.module.css';

/** Day column width; the CSS uses the same value (--col). */
const COL = 44;
const weekday = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
const dayOfMonth = (iso: string) => Number(iso.slice(8, 10));
const monthName = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });

/**
 * The coming-up strip: eight weeks ahead in a few packed rows. Each pill's
 * colored fill covers its real dates; a diamond marks a plan-by date.
 * Tapping one flies the globe above to it. Plan-by dates are editorial
 * booking windows (lib/alerts/leadTimes.ts), never live availability.
 */
export function ComingUp({ today, events, onOpen }: { today: string; events: readonly WorldEvent[]; onOpen: (event: WorldEvent) => void }) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const lanes = useMemo(() => buildLanes(events, today), [events, today]);
  const rows = useMemo(() => packRows(lanes, COL), [lanes]);
  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(today, i)), [today]);
  const onNow = events.filter((event) => event.start <= today && event.end >= today).length;
  const thisWeek = events.filter((event) => event.start > today && daysBetween(today, event.start) <= 7).length;
  const planSoon = lanes.filter((lane) => lane.planCol !== undefined && lane.planCol <= 14).length;
  const summary = [
    onNow ? `${onNow} on now` : '',
    thisWeek ? `${thisWeek} starting this week` : '',
    planSoon ? `${planSoon} to plan in the next two weeks` : '',
  ].filter(Boolean).join(' · ') || (lanes.length ? 'The next eight weeks' : 'Nothing on the calendar for the next eight weeks');

  const page = (direction: 1 | -1) => scroller.current?.scrollBy({ left: direction * COL * 7, behavior: 'smooth' });

  return (
    <section className={styles.shell} aria-labelledby="coming-up-title">
      <div className={styles.head}>
        <div>
          <p className={styles.kicker}>COMING UP · {weekday(today)}, {shortDate(today)}</p>
          <h2 id="coming-up-title" className={styles.title}>The next eight weeks</h2>
          <p className={styles.summary}>{summary}</p>
        </div>
        <div className={styles.pager}>
          <button type="button" onClick={() => page(-1)} aria-label="Earlier week">‹</button>
          <button type="button" onClick={() => page(1)} aria-label="Later week">›</button>
        </div>
      </div>

      <div ref={scroller} className={styles.scroller} tabIndex={0} role="region" aria-label="Next eight weeks, scroll sideways">
        <div className={styles.grid} style={{ ['--days' as string]: DAYS, ['--col' as string]: `${COL}px` }}>
          <div className={styles.dayRow} aria-hidden="true">
            {days.map((iso, i) => {
              const dow = new Date(`${iso}T12:00:00Z`).getUTCDay();
              return (
                <span key={iso} className={styles.day} data-today={i === 0 || undefined} data-weekend={dow === 0 || dow === 6 || undefined} data-week={dow === 1 || undefined}>
                  {(i === 0 || dayOfMonth(iso) === 1) && <em>{monthName(iso)}</em>}
                  <small>{weekday(iso).slice(0, 1)}</small>
                  {dayOfMonth(iso)}
                </span>
              );
            })}
          </div>
          <ol className={styles.rows}>
            {rows.map((row, r) => (
              <li key={r} className={styles.row}>
                {row.map((lane) => {
                  const { event, why, bar, planCol } = lane;
                  const when = why.planBy ? `${why.when}. ${why.planBy.label}` : why.when;
                  return (
                    <button
                      key={event.id}
                      type="button"
                      className={styles.item}
                      data-tone={bar ? why.tone : 'plan'}
                      style={{ ['--start' as string]: lane.start, ['--end' as string]: lane.end }}
                      onClick={() => onOpen(event)}
                      aria-label={`${event.name}, ${event.city}: ${when}. Show it on the globe`}
                      title={`${event.name} · ${event.city} · ${when}`}
                    >
                      {bar && <span className={styles.fill} style={{ ['--from' as string]: bar.from - lane.start, ['--to' as string]: bar.to + 1 - lane.start }} aria-hidden="true" />}
                      {planCol !== undefined && (
                        <>
                          <i className={styles.diamond} data-urgency={why.planBy?.urgency} style={{ ['--at' as string]: planCol - lane.start }} aria-hidden="true" />
                          {bar && planCol < bar.from && <span className={styles.lead} style={{ ['--from' as string]: planCol - lane.start + 0.5, ['--to' as string]: bar.from - lane.start }} aria-hidden="true" />}
                        </>
                      )}
                      <span className={styles.label} style={{ ['--at' as string]: (bar ? bar.from : (planCol ?? lane.start)) - lane.start + (bar ? 0 : 0.6) }}>
                        {bar ? <><strong>{shortName(event.name)}</strong> · {event.city}</> : <><strong>{planWord(lane)}</strong> → {shortName(event.name)}</>}
                      </span>
                    </button>
                  );
                })}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <p className={styles.legend}>
        <span><i data-tone="now" />On now</span>
        <span><i data-tone="soon" />Starting soon</span>
        <span><i data-tone="later" />Later</span>
        <span><b data-urgency="critical" />Plan-by date</span>
        <span className={styles.legendNote}>Plan-by dates are editorial booking windows, not live availability. Tap any to see it on the globe.</span>
      </p>
    </section>
  );
}
