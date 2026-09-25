'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ConcertResult, EventKind, LiveEvent } from '@/lib/designer/concerts';
import type { TasteInput } from '@/lib/designer/scene';
import styles from './designer.module.css';
import { KIND_STYLE, MusicWorldMap, pinKey } from './MusicWorldMap';

function formatDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

const SOURCE_LABEL = { ticketmaster: 'Ticketmaster', seatgeek: 'SeatGeek' } as const;

export function EventCard({ event }: { event: LiveEvent }) {
  const style = KIND_STYLE[event.kind];
  return (
    <a className={styles.showCard} href={event.url} target="_blank" rel="noopener noreferrer">
      <span className={styles.showArt}>
        {event.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- provider event artwork
          <img src={event.image} alt="" loading="lazy" />
        ) : (
          <span aria-hidden>{event.kind === 'tribute' ? '🎸' : event.kind === 'festival' ? '🎪' : '🎤'}</span>
        )}
        <span className={styles.showKind} style={{ background: style.color }}>
          {event.kind === 'festival' ? 'Festival' : event.kind === 'tribute' ? 'Tribute / cover' : event.kind === 'artist' ? 'Live' : event.kind === 'game' ? (event.away ? 'Away game' : 'Game') : 'Your scene'}
        </span>
        {event.fit !== undefined ? (
          <span className={styles.showFit} title="Jev’s read of how well this fits your taste">
            {Math.round(event.fit * 100)}% your vibe
          </span>
        ) : null}
      </span>
      <span className="grid gap-1 p-3">
        <span className="text-[11px] uppercase tracking-[0.12em] text-brass">
          {formatDate(event.date)}
          {event.time ? ` · ${event.time}` : ''}
        </span>
        <span className="text-[14px] font-semibold leading-5 text-ink">{event.name}</span>
        <span className="text-[12px] text-ink-muted">{[event.venue, event.city, event.country].filter(Boolean).join(' · ')}</span>
        {event.kind === 'festival' && event.artist ? <span className="text-[12px] text-brass-bright">{event.artist} is on the bill</span> : null}
        <span className="text-[11px] text-ink-subtle">
          {SOURCE_LABEL[event.source]}
          {event.price ? ` · listed ${event.price}, check current price` : ''}
        </span>
      </span>
    </a>
  );
}

const GROUPS: [EventKind, string][] = [
  ['festival', 'Festivals with your artists'],
  ['artist', 'Your artists on tour'],
  ['tribute', 'Tribute & cover acts'],
];

/** Where the traveler's artists are playing around the world, on a map and as cards. */
export function LiveShows({ artists, hometown, taste }: { artists: string[]; hometown?: string; taste?: TasteInput }) {
  const [scope, setScope] = useState<'world' | 'home'>('world');
  const [result, setResult] = useState<ConcertResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const key = `${artists.join('|')}|${scope}`;

  useEffect(() => {
    let cancelled = false;
    // Tour dates don't move by the minute: reuse this visit's answer for an hour, so the feeds' daily quota lasts.
    const cacheKey = `dope.concerts.v1:${key}:${taste ? 1 : 0}`;
    try {
      const cached = JSON.parse(window.sessionStorage.getItem(cacheKey) ?? 'null') as ConcertResult | null;
      if (cached && Date.now() - Date.parse(cached.fetchedAt) < 3_600_000) {
        const timer = window.setTimeout(() => { if (!cancelled) { setResult(cached); setSelected(null); setFailed(false); } }, 0);
        return () => { cancelled = true; window.clearTimeout(timer); };
      }
    } catch {
      // Storage off: fetch as usual.
    }
    fetch('/api/designer/concerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artists, city: scope === 'home' ? hometown : undefined, taste }),
    })
      .then((response) => (response.ok ? (response.json() as Promise<ConcertResult>) : Promise.reject(new Error('failed'))))
      .then((body) => {
        if (cancelled) return;
        try { if (body.source !== 'links') window.sessionStorage.setItem(cacheKey, JSON.stringify(body)); } catch { /* storage full or off */ }
        setResult(body);
        setSelected(null);
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // `key` captures artists + scope; the arrays change identity every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const events = useMemo(() => result?.concerts ?? [], [result]);
  const visible = selected ? events.filter((event) => pinKey(event) === selected) : events;
  const live = result && result.source !== 'links';

  return (
    <section className="mt-10" aria-labelledby="live-title">
      <div className={styles.row}>
        <h2 id="live-title" className="font-display text-[26px] text-ink">
          Your music on the map
        </h2>
        {result ? (
          <span className={styles.badge}>
            {live
              ? `${result.sources.map((source) => SOURCE_LABEL[source]).join(' + ')} · checked ${new Date(result.fetchedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
              : 'Event feeds not connected · search links'}
          </span>
        ) : null}
        {hometown ? (
          <div className={`${styles.seg} ml-auto`} role="group" aria-label="Where">
            <button type="button" className={`${styles.segBtn} ${scope === 'world' ? styles.segOn : ''}`} onClick={() => setScope('world')} aria-pressed={scope === 'world'}>
              Worldwide
            </button>
            <button type="button" className={`${styles.segBtn} ${scope === 'home' ? styles.segOn : ''}`} onClick={() => setScope('home')} aria-pressed={scope === 'home'}>
              Near {hometown.split(',')[0]}
            </button>
          </div>
        ) : null}
      </div>
      <p className="mt-1 text-[13px] text-ink-muted">
        Tour dates, festivals with {artists.slice(0, 3).join(', ')} on the bill, and bands that play their songs. Tap a pin to see what’s there.
      </p>

      {!result && !failed ? <p className="mt-3 text-[13px] text-ink-muted">Checking tour dates…</p> : null}
      {failed ? <p className={styles.notice}>Shows could not be checked right now.</p> : null}

      {live ? (
        <>
          <MusicWorldMap events={events} selected={selected} onSelect={setSelected} />
          {selected ? (
            <button type="button" className={`${styles.miniBtn} mt-2`} onClick={() => setSelected(null)}>
              Show everywhere
            </button>
          ) : null}
          {visible.length ? (
            GROUPS.map(([kind, label]) => {
              const list = visible.filter((event) => event.kind === kind).sort((a, b) => (b.fit ?? 1) - (a.fit ?? 1) || a.date.localeCompare(b.date));
              return list.length ? (
                <div key={kind} className="mt-4">
                  <p className={styles.factTitle}>{label}</p>
                  <div className={styles.strip}>
                    {list.map((event) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                  </div>
                </div>
              ) : null;
            })
          ) : (
            <p className="mt-3 text-[13px] text-ink-muted">No upcoming shows found{scope === 'home' ? ` near ${hometown?.split(',')[0]}` : ''}. Try the links below.</p>
          )}
        </>
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
