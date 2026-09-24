'use client';

import { useEffect, useState } from 'react';
import { HERO_POOL, heroRun, heroSrc, heroSrcSet, markSeen, type HeroPhoto } from '@/lib/hero/pool';
import styles from './world-intro.module.css';

const SEEN_KEY = 'dope.hero.seen.v1';
const RUN = 5;
const HOLD_MS = 9000;

function readSeen(): string[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string').slice(-80) : [];
  } catch {
    return [];
  }
}

function writeSeen(ids: string[]) {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
  } catch {
    // Private mode: rotation still works, it just can't favour unseen photos next time.
  }
}

/**
 * The living hero: a new run of real photos each visit (unseen first), slow
 * crossfades between them, the place and credit always on screen. The
 * designed collage stays underneath as the first paint and the fallback.
 */
export function HeroPool() {
  const [run, setRun] = useState<HeroPhoto[]>([]);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const next = heroRun(readSeen(), RUN);
    const timer = window.setTimeout(() => setRun(next), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const current = run[index];

  useEffect(() => {
    if (!current || !loaded[current.id]) return;
    writeSeen(markSeen(readSeen(), [current.id]));
    if (run.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setTimeout(() => {
      if (document.visibilityState === 'visible') setIndex((value) => (value + 1) % run.length);
    }, HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [current, loaded, run.length, index]);

  if (!run.length) return null;
  // Mount the previous photo (held fully visible underneath, so a crossfade
  // never reveals the collage), the current one fading in on top, and the
  // next one (so it's loaded before its fade).
  const next = run[(index + 1) % run.length];
  const previous = run.length > 2 ? run[(index - 1 + run.length) % run.length] : undefined;
  const mounted = [...new Set([previous, current, next].filter((photo): photo is HeroPhoto => Boolean(photo)))];

  return (
    <>
      <div className={styles.heroPool} aria-hidden="true">
        {mounted.map((photo) => (
          // eslint-disable-next-line @next/next/no-img-element -- local, pre-sized WebP
          <img
            key={photo.id}
            src={heroSrc(photo, 1600)}
            srcSet={heroSrcSet(photo)}
            sizes="100vw"
            alt=""
            decoding="async"
            fetchPriority={photo === current && index === 0 ? 'high' : 'low'}
            onLoad={() => setLoaded((value) => ({ ...value, [photo.id]: true }))}
            className={
              photo === current && loaded[photo.id]
                ? styles.heroPoolOn
                : photo === previous && loaded[photo.id]
                  ? styles.heroPoolUnder
                  : undefined
            }
          />
        ))}
      </div>
      {current && loaded[current.id] ? (
        <p className={styles.heroPlace}>
          <span className={styles.heroPlaceName}>
            <span aria-hidden="true">◉ </span>
            {current.scene} · {current.city}, {current.region}
          </span>
          <a href={current.sourceUrl} target="_blank" rel="noopener noreferrer" title={current.title}>
            {current.credit} · {current.license} ↗
          </a>
        </p>
      ) : null}
    </>
  );
}

export const HERO_POOL_SIZE = HERO_POOL.length;
