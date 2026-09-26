'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { TripIdeasResponse } from '@/lib/designer/tripIdeas';
import styles from './designer.module.css';
import { KIND_STYLE } from './MusicWorldMap';
import { SourceLogo } from '@/components/brand/SourceLogo';

function short(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** Trips built around the traveler's artists and teams. */
export function TripIdeas({ artists, teams, homeCity }: { artists: string[]; teams: string[]; homeCity?: string }) {
  const [result, setResult] = useState<TripIdeasResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const key = `${artists.join('|')}#${teams.join('|')}#${homeCity ?? ''}`;

  useEffect(() => {
    let live = true;
    fetch('/api/designer/trip-ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artists, teams, homeCity }),
    })
      .then((response) => (response.ok ? (response.json() as Promise<TripIdeasResponse>) : Promise.reject(new Error('failed'))))
      .then((body) => live && setResult(body))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
    // `key` captures the inputs; arrays change identity every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <section className="mt-10" aria-labelledby="ideas-title">
      <div className={styles.row}>
        <h2 id="ideas-title" className="font-display text-[26px] text-ink">
          Trips built around what you love
        </h2>
        {result?.sources.length ? <span className={styles.badge}>{result.sources.join(' + ')} · next 12 months</span> : null}
      </div>
      <p className="mt-1 text-[13px] text-ink-muted">
        Where {[...artists.slice(0, 2), ...teams.slice(0, 1)].join(', ')} line up in the same city, in the same few days, ideally during something special.
      </p>
      {!result && !failed ? <p className="mt-3 text-[13px] text-ink-muted">Lining up the calendar…</p> : null}
      {failed ? <p className={styles.notice}>Trip ideas could not be checked right now.</p> : null}
      {result && !result.sources.length ? (
        <p className={styles.notice}>Event feeds aren’t connected yet, so there are no trip ideas to rank. Nothing here is guessed.</p>
      ) : null}
      {result?.sources.length && !result.ideas.length ? <p className="mt-3 text-[13px] text-ink-muted">Nothing lines up in the next year yet. Check back as tours are announced.</p> : null}
      {result?.ideas.length ? (
        <div className={styles.ideas}>
          {result.ideas.map((idea, index) => (
            <article key={idea.key} className={styles.idea}>
              <p className={styles.factTitle}>
                #{index + 1} · {short(idea.start)} → {short(idea.end)} · {idea.nights} nights
              </p>
              <h3 className="mt-1 font-display text-[26px] leading-tight text-ink">
                {idea.city}
                {idea.country ? <span className="text-[15px] text-ink-muted"> {idea.country}</span> : null}
              </h3>
              <p className="mt-1 text-[13.5px] text-ink-muted">{idea.why}</p>
              <ul className="mt-3 grid gap-1.5">
                {idea.events.map((event) => (
                  <li key={event.id} className="flex min-w-0 items-center gap-2 text-[12.5px]">
                    <i className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: KIND_STYLE[event.kind].color }} aria-hidden />
                    <SourceLogo source={event.url} size={13} className="shrink-0" />
                    <a className="min-w-0 truncate text-ink hover:underline" href={event.url} title={event.name} target="_blank" rel="noopener noreferrer">
                      {short(event.date)} · {event.name}
                    </a>
                  </li>
                ))}
                {idea.occasions.map((occasion) => (
                  <li key={occasion.id} className="flex items-center gap-2 text-[12.5px]">
                    <i className="inline-block h-2 w-2 shrink-0 rounded-full bg-brass" aria-hidden />
                    <Link className="truncate text-brass-bright hover:underline" href={occasion.href ?? `/?event=${encodeURIComponent(occasion.id)}`}>
                      Also on: {occasion.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
