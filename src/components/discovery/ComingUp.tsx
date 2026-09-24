'use client';

import { useEffect, useMemo, useState } from 'react';
import { addDays, daysBetween } from '@/lib/buzz/dates';
import { buildLanes, COMING_UP_DAYS as DAYS } from '@/lib/discovery/comingUp';
import { shortDate } from '@/lib/discovery/whyNow';
import type { WorldEvent } from '@/lib/types';
import styles from './coming-up.module.css';

const OPEN_KEY = 'dope.comingup.open.v1';

const weekday = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
const dayOfMonth = (iso: string) => Number(iso.slice(8, 10));
const monthName = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });

/**
 * The horizontal "coming up" calendar: today on the left, eight weeks out,
 * what's on and what starts soon, and the plan-by date for the trips worth
 * committing to early. Plan-by dates are editorial booking windows (see
 * lib/alerts/leadTimes.ts), never live availability.
 */
export function ComingUp({ today, events, onOpen }: { today: string; events: readonly WorldEvent[]; onOpen: (event: WorldEvent) => void }) {
  // null until the stored choice is read: desktop shows the calendar, phones hide
  // it with CSS, so reading the choice never shifts the page.
  const [choice, setChoice] = useState<boolean | null>(null);
  useEffect(() => {
    let stored: string | null = null;
    try { stored = window.localStorage.getItem(OPEN_KEY); } catch { /* storage can be off */ }
    const phone = window.matchMedia('(max-width: 640px)').matches;
    const timer = window.setTimeout(() => setChoice(stored === '1' ? true : stored === '0' ? false : !phone), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const open = choice ?? true;
  const toggle = () => {
    const visible = choice ?? !window.matchMedia('(max-width: 640px)').matches;
    try { window.localStorage.setItem(OPEN_KEY, visible ? '0' : '1'); } catch { /* in-memory still works */ }
    setChoice(!visible);
  };

  const lanes = useMemo(() => buildLanes(events, today), [events, today]);
  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(today, i)), [today]);
  const onNow = lanes.filter((lane) => lane.why.tone === 'now').length;
  const thisWeek = lanes.filter((lane) => lane.why.tone === 'soon' && daysBetween(today, lane.event.start) <= 7).length;
  const planSoon = lanes.filter((lane) => lane.planCol !== undefined && lane.planCol <= 14).length;
  const summary = [
    onNow ? `${onNow} on now` : '',
    thisWeek ? `${thisWeek} starting this week` : '',
    planSoon ? `${planSoon} to plan in the next two weeks` : '',
  ].filter(Boolean).join(' · ') || 'Nothing on the calendar for the next eight weeks';

  return (
    <section className={styles.shell} aria-label="Coming up">
      <div className={styles.head}>
        <p className={styles.today}>
          <span className={styles.kicker}>Today</span>
          <strong>{weekday(today)}, {shortDate(today)}</strong>
          <span className={styles.summary}>{summary}</span>
        </p>
        <button type="button" className={styles.toggle} onClick={toggle} aria-expanded={open} data-undecided={choice === null || undefined}>
          <span className={styles.whenOpen}>Hide calendar <span aria-hidden="true">▴</span></span>
          <span className={styles.whenClosed}>Show calendar <span aria-hidden="true">▾</span></span>
        </button>
      </div>

      {open && (
        <div className={choice === null ? styles.bodyUndecided : undefined}>
          <div className={styles.scroller} tabIndex={0} aria-label="Next eight weeks, scroll sideways">
            <div className={styles.grid} style={{ ['--days' as string]: DAYS }}>
              <div className={styles.dayRow} aria-hidden="true">
                {days.map((iso, i) => {
                  const dow = new Date(`${iso}T12:00:00Z`).getUTCDay();
                  return (
                    <span key={iso} className={styles.day} data-today={i === 0 || undefined} data-weekend={dow === 0 || dow === 6 || undefined}>
                      {(i === 0 || dayOfMonth(iso) === 1) && <em>{monthName(iso)}</em>}
                      <small>{weekday(iso).slice(0, 2)}</small>
                      {dayOfMonth(iso)}
                    </span>
                  );
                })}
              </div>
              <ol className={styles.lanes}>
                {lanes.map((lane) => {
                  const { event, why, bar, planCol } = lane;
                  const label = `${event.city} · ${event.name}`;
                  const leadEnd = bar ? bar.from : DAYS;
                  return (
                    <li key={event.id} className={styles.lane}>
                      {planCol !== undefined && (
                        <>
                          <span
                            className={styles.lead}
                            style={{ ['--from' as string]: planCol + 0.5, ['--to' as string]: leadEnd }}
                            aria-hidden="true"
                          />
                          <button
                            type="button"
                            className={styles.plan}
                            data-urgency={why.planBy?.urgency}
                            style={{ ['--col-n' as string]: planCol }}
                            onClick={() => onOpen(event)}
                            aria-label={`${why.planBy?.label}, for ${label} (${shortDate(event.start)})`}
                            title={`${why.planBy?.label} · ${label}, ${shortDate(event.start)}`}
                          >
                            <i aria-hidden="true" />
                            {!bar && <span>{why.planBy?.label} → {event.name}, {event.city} · {shortDate(event.start)}</span>}
                          </button>
                        </>
                      )}
                      {bar && (
                        <button
                          type="button"
                          className={styles.bar}
                          data-tone={why.tone}
                          style={{ ['--from' as string]: bar.from, ['--to' as string]: bar.to + 1 }}
                          onClick={() => onOpen(event)}
                          aria-label={`${label}: ${why.when}${why.planBy ? `. ${why.planBy.label}` : ''}`}
                          title={`${label} · ${why.when}${why.reason ? ` · ${why.reason}` : ''}`}
                        >
                          <strong>{event.city}</strong> {event.name}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
          <p className={styles.legend}>
            <span><i data-tone="now" />On now</span>
            <span><i data-tone="soon" />Starting soon</span>
            <span><b data-urgency="critical" />Last call</span>
            <span><b data-urgency="closing" />Plan soon</span>
            <span><b data-urgency="open" />Plan by</span>
            <span className={styles.legendNote}>Plan-by dates are editorial booking windows for the best rooms, tables and spots, not live availability.</span>
          </p>
        </div>
      )}
    </section>
  );
}
