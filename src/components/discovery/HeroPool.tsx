'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { HERO_POOL, heroRun, heroSrc, heroSrcSet, markSeen, type HeroPhoto } from '@/lib/hero/pool';
import { photoArchiveLabel } from '@/lib/place-media/curated';
import type { PlacePhoto } from '@/lib/place-media/media';
import { photoImageProps } from '@/lib/place-media/sources';
import styles from './world-intro.module.css';

const SEEN_KEY = 'dope.hero.seen.v1';
const RUN = 5;
const HOLD_MS = 9000;
/** A traveler who saw the lead photo recently gets it only briefly before their own run. */
const SEEN_LEAD_HOLD_MS = 1200;
/**
 * Server-rendered first frame, so the largest image starts downloading from the
 * HTML instead of waiting for hydration. Rotation continues from it.
 */
const LEAD = HERO_POOL.find((photo) => photo.id === 'rio-de-janeiro-copacabana-beach-124') ?? HERO_POOL[0];

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

/** Where the pass card (with the featured trip's photo) is hidden: the hero carries that photo instead. */
const NO_PASS = '(max-width: 760px)';
const subscribeNoPass = (onChange: () => void) => {
  const query = window.matchMedia(NO_PASS);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};

/** The trip the hero's button is about, when it has a reviewed photo of its own. */
export type HeroFeature = { key: string; photo: PlacePhoto; event: string; place: string };

/**
 * The living hero: a lead photo in the server HTML, then a run of real photos
 * for this visit (unseen first), slow crossfades between them, the place and
 * credit always on screen. An evening-sky gradient sits underneath. When the
 * featured trip has its own photo, the hero settles on it, so the picture,
 * the button and the caption are about the same place.
 */
export function HeroPool({ feature: offered = null }: { feature?: HeroFeature | null }) {
  const noPass = useSyncExternalStore(subscribeNoPass, () => window.matchMedia(NO_PASS).matches, () => false);
  const feature = noPass ? offered : null;
  const [featureState, setFeatureState] = useState<{ key: string; status: 'loaded' | 'failed' } | null>(null);
  const featureShown = feature && featureState?.key === feature.key && featureState.status === 'loaded' ? feature : null;
  const [run, setRun] = useState<HeroPhoto[]>([LEAD]);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [advanced, setAdvanced] = useState(false);
  const [leadIsStale, setLeadIsStale] = useState(false);

  useEffect(() => {
    const seen = readSeen();
    const rest = heroRun(seen, RUN).filter((photo) => photo.id !== LEAD.id);
    const timer = window.setTimeout(() => {
      setRun([LEAD, ...rest].slice(0, RUN));
      setLeadIsStale(seen.slice(-6).includes(LEAD.id));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // The lead image can finish loading before hydration, when React isn't listening yet.
  const markIfComplete = (photo: HeroPhoto) => (image: HTMLImageElement | null) => {
    if (image?.complete && image.naturalWidth > 0 && !loaded[photo.id]) {
      setLoaded((value) => ({ ...value, [photo.id]: true }));
    }
  };

  const current = run[index];

  useEffect(() => {
    if (!current || !loaded[current.id]) return;
    writeSeen(markSeen(readSeen(), [current.id]));
    if (featureShown || run.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const hold = index === 0 && leadIsStale ? SEEN_LEAD_HOLD_MS : HOLD_MS;
    const timer = window.setTimeout(() => {
      if (document.visibilityState !== 'visible') return;
      setAdvanced(true);
      setIndex((value) => (value + 1) % run.length);
    }, hold);
    return () => window.clearTimeout(timer);
  }, [current, loaded, run.length, index, leadIsStale, featureShown]);

  if (!run.length) return null;
  // Mount the previous photo (held fully visible underneath, so a crossfade
  // never reveals the collage), the current one fading in on top, and the
  // next one (so it's loaded before its fade).
  // The next photo only starts downloading once this one is on screen, so it
  // never competes with the first paint on a slow connection.
  const next = loaded[current.id] ? run[(index + 1) % run.length] : undefined;
  // Nothing is "previous" until the first change; otherwise the run's last photo would download up front.
  const previous = advanced && run.length > 2 ? run[(index - 1 + run.length) % run.length] : undefined;
  const mounted = [...new Set([previous, current, next].filter((photo): photo is HeroPhoto => Boolean(photo)))];

  return (
    <>
      <div className={styles.heroPool} aria-hidden="true">
        {mounted.map((photo) => (
          // eslint-disable-next-line @next/next/no-img-element -- local, pre-sized WebP
          <img
            key={photo.id}
            ref={markIfComplete(photo)}
            src={heroSrc(photo, 1600)}
            srcSet={heroSrcSet(photo)}
            sizes="100vw"
            alt=""
            style={{ objectPosition: `62% ${photo.focusY ?? 55}%` }}
            decoding="async"
            fetchPriority={photo === current && index === 0 ? 'high' : 'low'}
            onLoad={() => setLoaded((value) => ({ ...value, [photo.id]: true }))}
            className={
              // The lead shows as its bytes arrive (no fade), so it paints before hydration.
              photo === current && (loaded[photo.id] || (photo.id === LEAD.id && !advanced))
                ? styles.heroPoolOn
                : photo === previous && loaded[photo.id]
                  ? styles.heroPoolUnder
                  : undefined
            }
          />
        ))}
        {feature && !(featureState?.key === feature.key && featureState.status === 'failed') ? (
          // A reviewed photo of the featured trip, crossfading over the scenery once it has loaded.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`feature-${feature.key}`}
            {...photoImageProps(feature.photo, 'hero')}
            alt=""
            decoding="async"
            fetchPriority="low"
            referrerPolicy="no-referrer"
            onLoad={() => setFeatureState({ key: feature.key, status: 'loaded' })}
            onError={() => setFeatureState({ key: feature.key, status: 'failed' })}
            className={featureShown ? styles.heroPoolOn : undefined}
          />
        ) : null}
      </div>
      {featureShown ? (
        <p className={styles.heroPlace}>
          <span className={styles.heroPlaceName}>
            <span aria-hidden="true">◉ </span>
            {featureShown.photo.subject === 'event' ? featureShown.event : featureShown.place} · {photoArchiveLabel(featureShown.photo)}
          </span>
          <a href={featureShown.photo.sourceUrl} target="_blank" rel="noopener noreferrer" title={featureShown.photo.title}>
            {featureShown.photo.credit} · {featureShown.photo.license} ↗
          </a>
        </p>
      ) : current && loaded[current.id] ? (
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
