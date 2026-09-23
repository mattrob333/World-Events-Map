'use client';

import { useEffect, useState } from 'react';
import type { ConcertResult } from '@/lib/designer/concerts';
import styles from './designer.module.css';

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/** Upcoming shows by the traveler's artists, plus tribute and cover acts. */
export function LiveShows({ artists, hometown }: { artists: string[]; hometown?: string }) {
  const [nearHome, setNearHome] = useState(Boolean(hometown));
  const [result, setResult] = useState<ConcertResult | null>(null);
  const [failed, setFailed] = useState(false);
  const key = `${artists.join('|')}|${nearHome ? hometown : ''}`;

  useEffect(() => {
    let cancelled = false;
    fetch('/api/designer/concerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artists, city: nearHome ? hometown : undefined }),
    })
      .then((response) => (response.ok ? (response.json() as Promise<ConcertResult>) : Promise.reject(new Error('failed'))))
      .then((body) => {
        if (!cancelled) {
          setResult(body);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // `key` captures artists + city; the arrays themselves change identity each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const tributes = result?.concerts.filter((c) => c.kind === 'tribute') ?? [];
  const tours = result?.concerts.filter((c) => c.kind === 'artist') ?? [];

  return (
    <section className="mt-10" aria-labelledby="live-title">
      <div className={styles.row}>
        <h2 id="live-title" className="font-display text-[26px] text-ink">
          Live for you
        </h2>
        {result ? (
          <span className={styles.badge}>
            {result.source === 'ticketmaster' ? `Ticketmaster · checked ${new Date(result.fetchedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Search links'}
          </span>
        ) : null}
        {hometown ? (
          <div className={`${styles.seg} ml-auto`} role="group" aria-label="Where">
            <button type="button" className={`${styles.segBtn} ${nearHome ? styles.segOn : ''}`} onClick={() => setNearHome(true)} aria-pressed={nearHome}>
              Near {hometown.split(',')[0]}
            </button>
            <button type="button" className={`${styles.segBtn} ${!nearHome ? styles.segOn : ''}`} onClick={() => setNearHome(false)} aria-pressed={!nearHome}>
              Anywhere
            </button>
          </div>
        ) : null}
      </div>

      {!result && !failed ? <p className="mt-3 text-[13px] text-ink-muted">Looking for shows…</p> : null}
      {failed ? <p className={styles.notice}>Shows could not be checked right now.</p> : null}

      {result?.source === 'ticketmaster' ? (
        tours.length || tributes.length ? (
          <>
            {[
              ['On tour', tours],
              ['Tribute & cover acts', tributes],
            ].map(([label, list]) =>
              (list as ConcertResult['concerts']).length ? (
                <div key={label as string} className="mt-4">
                  <p className={styles.factTitle}>{label as string}</p>
                  <div className={styles.strip}>
                    {(list as ConcertResult['concerts']).map((concert) => (
                      <a key={concert.id} className={styles.showCard} href={concert.url} target="_blank" rel="noopener noreferrer">
                        <span className={styles.showArt}>
                          {concert.image ? (
                            // eslint-disable-next-line @next/next/no-img-element -- Ticketmaster event artwork
                            <img src={concert.image} alt="" loading="lazy" />
                          ) : (
                            <span aria-hidden>{concert.kind === 'tribute' ? '🎸' : '🎤'}</span>
                          )}
                        </span>
                        <span className="grid gap-1 p-3">
                          <span className="text-[11px] uppercase tracking-[0.12em] text-[#fdba74]">{formatDate(concert.date)}{concert.time ? ` · ${concert.time}` : ''}</span>
                          <span className="text-[14px] font-semibold leading-5 text-ink">{concert.name}</span>
                          <span className="text-[12px] text-ink-muted">{[concert.venue, concert.city].filter(Boolean).join(' · ')}</span>
                          {concert.price ? <span className="text-[11.5px] text-ink-faint">Listed {concert.price} · check Ticketmaster for current prices</span> : null}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              ) : null,
            )}
          </>
        ) : (
          <p className="mt-3 text-[13px] text-ink-muted">No upcoming shows found on Ticketmaster{nearHome && hometown ? ` near ${hometown.split(',')[0]}` : ''}. Try “Anywhere”, or the links below.</p>
        )
      ) : null}

      {result ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-[13px] text-ink-muted">Search every artist on Ticketmaster and Bandsintown</summary>
          <ul className="mt-2 grid gap-1">
            {result.links.map((link) => (
              <li key={link.href}>
                <a className={styles.cardLink} href={link.href} target="_blank" rel="noopener noreferrer">
                  {link.label} ↗
                </a>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
