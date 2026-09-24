'use client';

import { useEffect, useMemo, useState } from 'react';
import type { SceneResponse } from '@/lib/designer/concerts';
import { scenePlaybook, type TasteInput } from '@/lib/designer/scene';
import styles from './designer.module.css';
import { EventCard } from './LiveShows';

type Persona = {
  venueStyle: string;
  venueConfidence: number;
  coverBands: number;
  festivals: number;
  singAlong: number;
  energy: number;
};

const VENUE_LABEL: Record<string, string> = {
  dive_bar: 'Bars, pubs & roadhouses with a band',
  listening_room: 'Listening rooms & jazz clubs',
  lounge: 'Lounges, hotel bars & rooftops',
  club: 'Big clubs & late dance floors',
  arena: 'Arena & stadium shows',
  festival: 'Festivals & big lineups',
};
const ENERGY_LABEL = ['Background music', 'Casual, home by midnight', 'Sings along, stays for the encore', 'Front row, last song of the night'];

/** Jev's read of the listener, when configured. */
export function usePersona(taste: TasteInput | null, extra: { listeningHours?: string; playlistHabits?: string[] }) {
  const [persona, setPersona] = useState<Persona | null>(null);
  const key = taste ? `${taste.genres.join('|')}|${taste.topArtists?.join('|')}` : '';
  useEffect(() => {
    if (!taste) return;
    let live = true;
    fetch('/api/designer/persona', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taste, ...extra }),
    })
      .then((response) => (response.ok ? (response.json() as Promise<{ persona: Persona | null }>) : null))
      .then((body) => live && setPersona(body?.persona ?? null))
      .catch(() => undefined);
    return () => {
      live = false;
    };
    // `key` captures the taste; objects change identity every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return persona;
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

/**
 * The traveler's live-music playbook: the scenes they'd love anywhere, Jev's
 * read of the room they want, and a finder for any city and dates.
 */
export function ScenePlaybook({
  taste,
  persona,
  initialCity = '',
  startDate,
  endDate,
  title = 'Your live-music playbook',
  compact = false,
}: {
  taste: TasteInput;
  persona?: Persona | null;
  initialCity?: string;
  startDate?: string;
  endDate?: string;
  title?: string;
  compact?: boolean;
}) {
  const playbook = useMemo(() => scenePlaybook(taste), [taste]);
  const [cityInput, setCityInput] = useState(initialCity);
  const [city, setCity] = useState(initialCity);
  const [result, setResult] = useState<SceneResponse | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'failed'>('idle');

  useEffect(() => {
    if (!city || !playbook.length) return;
    let live = true;
    fetch('/api/designer/scene', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city, taste, startDate, endDate }),
    })
      .then((response) => (response.ok ? (response.json() as Promise<SceneResponse>) : Promise.reject(new Error('failed'))))
      .then((body) => {
        if (!live) return;
        setResult(body);
        setState('idle');
      })
      .catch(() => live && setState('failed'));
    return () => {
      live = false;
    };
    // Re-run for a new city or window; taste is stable for a mounted board.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, startDate, endDate, playbook.length]);

  if (!playbook.length) return null;

  return (
    <section className={compact ? styles.panel : 'mt-10'} aria-labelledby="playbook-title">
      <div className={styles.row}>
        <h2 id="playbook-title" className={compact ? 'text-[17px] font-semibold text-ink' : 'font-display text-[26px] text-ink'}>
          {title}
        </h2>
        {persona ? <span className={`${styles.badge} ${styles.badgeAi}`}>Read by Jev</span> : null}
      </div>

      {persona ? (
        <div className={styles.persona}>
          <div>
            <p className={styles.factTitle}>Your room</p>
            <p className="text-[15px] text-ink">{VENUE_LABEL[persona.venueStyle] ?? persona.venueStyle}</p>
          </div>
          <div>
            <p className={styles.factTitle}>Energy</p>
            <p className="text-[15px] text-ink">{ENERGY_LABEL[Math.round(persona.energy)]}</p>
          </div>
          <div className={styles.meters}>
            {[
              ['Cover bands', persona.coverBands],
              ['Festivals', persona.festivals],
              ['Sing-alongs', persona.singAlong],
            ].map(([label, value]) => (
              <div key={label as string} className={styles.meter}>
                <span>{label as string}</span>
                <span className={styles.meterTrack} aria-hidden>
                  <span style={{ width: pct(value as number) }} />
                </span>
                <span>{pct(value as number)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <ul className={styles.scenes}>
        {playbook.map((scene) => (
          <li key={scene.key} className={styles.scene}>
            <span className="text-[26px]" aria-hidden>
              {scene.emoji}
            </span>
            <span className="grid gap-1">
              <strong className="text-[14px] text-ink">{scene.label}</strong>
              <span className="text-[12px] text-ink-muted">{scene.why}</span>
              <span className="text-[11.5px] text-ink-subtle">Look for: {scene.venues.join(' · ')}</span>
            </span>
          </li>
        ))}
      </ul>

      {!initialCity || !compact ? (
        <form
          className={`${styles.row} mt-4`}
          onSubmit={(event) => {
            event.preventDefault();
            const next = cityInput.trim();
            if (next.length >= 2) {
              setState('loading');
              setCity(next);
            }
          }}
        >
          <label className={styles.label}>
            Going somewhere? Find your scene there
            <input className={styles.input} value={cityInput} maxLength={60} placeholder="Nashville, Lisbon, Tokyo…" onChange={(event) => setCityInput(event.target.value)} />
          </label>
          <button type="submit" className={styles.ghost} style={{ alignSelf: 'end' }}>
            Find live music
          </button>
        </form>
      ) : null}

      {state === 'loading' ? <p className="mt-3 text-[13px] text-ink-muted">Looking in {city}…</p> : null}
      {state === 'failed' ? <p className={styles.notice}>Live music could not be checked right now.</p> : null}

      {result && result.city.toLowerCase() === city.split(',')[0].trim().toLowerCase() ? (
        <div className="mt-4">
          <div className={styles.row}>
            <p className={styles.factTitle}>In {result.city}{startDate ? ' on your dates' : ''}</p>
            <span className={styles.badge}>
              {result.sources.length ? `${result.sources.join(' + ')}${result.judged ? ' · ranked by Jev' : ''}` : 'Event feeds not connected'}
            </span>
          </div>
          {result.events.length ? (
            <div className={styles.strip}>
              {result.events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : result.sources.length ? (
            <p className="mt-2 text-[13px] text-ink-muted">No listed shows match your scenes{startDate ? ' on those dates' : ''}. Bars with house bands rarely list on ticket sites; try these:</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {result.scenes.flatMap((scene) =>
              scene.links.slice(0, 1).map((link) => (
                <a key={link.href} className={styles.ghost} href={link.href} target="_blank" rel="noopener noreferrer">
                  {scene.emoji} {link.label} ↗
                </a>
              )),
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
