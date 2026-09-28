'use client';

import { MONTHS_LONG, MONTHS_SHORT, type Activity } from '@/lib/activity/activities';
import { currentMonth, type MonthSel } from '@/lib/activity/season';
import styles from './spot.module.css';

/**
 * Twelve months at a glance: good months filled, the best ones glowing, a dot
 * under this month. Tapping a month turns the whole globe to it.
 */
export function SeasonStrip({ activity, month, now, onPick }: {
  activity: Pick<Activity, 'bestMonths' | 'peakMonths'>;
  month: MonthSel;
  now: Date;
  onPick?: (m: number) => void;
}) {
  const cur = currentMonth(now);
  const sel = month === 'now' ? cur : month;
  return (
    <div className={styles.strip} role="group" aria-label="Season by month">
      {MONTHS_SHORT.map((m, i) => {
        const n = i + 1;
        const peak = activity.peakMonths.includes(n);
        const best = activity.bestMonths.includes(n);
        const state = peak ? 'peak' : best ? 'best' : 'off';
        const label = `${MONTHS_LONG[i]}: ${peak ? 'best time' : best ? 'good season' : 'off season'}${n === cur ? ', this month' : ''}`;
        return (
          <button
            key={m}
            type="button"
            className={styles.stripCell}
            data-state={state}
            data-selected={n === sel || undefined}
            aria-pressed={n === sel}
            aria-label={label}
            title={label}
            onClick={() => onPick?.(n)}
            style={{ ['--i' as string]: i }}
          >
            <span className={styles.stripBar} />
            <span className={styles.stripM}>{m.slice(0, 1)}</span>
            {n === cur ? <span className={styles.stripNow} aria-hidden="true" /> : null}
          </button>
        );
      })}
    </div>
  );
}
