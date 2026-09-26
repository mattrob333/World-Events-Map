'use client';

import { closesLabel, type PulseVenue } from '@/lib/now/pulse';
import type { Tonight } from '@/lib/now/tonight';
import { formatMiles } from '@/lib/units';
import styles from './nearby-pulse.module.css';

const pretty = (category: string) => category.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

function left(minutes: number | null): string {
  if (minutes === null) return '';
  if (minutes < 60) return `${minutes} min left`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m left` : `${h}h left`;
}

/**
 * Tonight, on an hourly scale: one row per place, a bar from now until it
 * closes (brighter where it's busier), so you can see what's still open
 * and for how long. Tap a row to see it on the map.
 */
export function TonightTimeline({ tonight, selected, onPick, winks }: { tonight: Tonight; selected: string | null; onPick: (venue: PulseVenue) => void; winks: ReadonlyMap<string, string | null> }) {
  return (
    <section className={styles.tonight} aria-labelledby="tonight-title">
      <div className={styles.tonightHead}>
        <h2 id="tonight-title">Tonight</h2>
        <p>Open now, and when each one closes.</p>
      </div>
      <div className={styles.scale} aria-hidden="true">
        {tonight.ticks.map((tick) => (
          <span key={tick.at} style={{ left: `${tick.position * 100}%` }}>{tick.label}</span>
        ))}
      </div>
      <ol className={styles.rows}>
        {tonight.rows.map(({ venue, from, to, minutesLeft }) => {
          const soon = minutesLeft !== null && minutesLeft <= 60;
          const closes = venue.openAllNight ? 'open all night' : closesLabel(venue.closesMinutes);
          return (
            <li key={venue.id}>
              <button type="button" className={styles.row} data-selected={selected === venue.id || undefined} onClick={() => onPick(venue)}>
                <span className={styles.rowName}>
                  <strong>{venue.name}</strong>
                  <small>
                    {pretty(venue.category)}{venue.distanceMeters !== undefined ? ` · ${formatMiles(venue.distanceMeters / 1000)}` : ''} · {venue.busyness}% busy{venue.basis === 'live' ? ' (live)' : ''}
                  </small>
                  {winks.get(venue.id) ? <em>{winks.get(venue.id)}</em> : null}
                </span>
                <span className={styles.track}>
                  {to === null ? (
                    <i className={styles.unknown} style={{ left: `${from * 100}%` }} />
                  ) : (
                    <i
                      className={styles.window}
                      data-soon={soon || undefined}
                      style={{ left: `${from * 100}%`, width: `${Math.max(2, (to - from) * 100)}%`, opacity: 0.45 + (venue.busyness / 100) * 0.55 }}
                    />
                  )}
                </span>
                <span className={styles.rowClose} data-soon={soon || undefined}>
                  {to === null ? 'hours unknown' : soon ? `last call · ${left(minutesLeft)}` : closes?.replace('open till', 'till') ?? ''}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
