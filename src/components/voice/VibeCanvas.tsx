'use client';

import { useEffect, useState } from 'react';
import { curatedPhotoForEvent } from '@/lib/place-media/curated';
import type { PlacePhoto } from '@/lib/place-media/media';
import { SPOT_EMOJI, SPOT_KINDS, SPOT_LABEL, samePlace, type Canvas, type CanvasPlace, type CanvasSpot } from '@/lib/voice/canvas';
import styles from './vibe-canvas.module.css';

const photoCache = new Map<string, string | null>();

/** The place's photo: our curated event photo, else a licensed Commons photo of the town or resort. */
function usePlacePhoto(place: CanvasPlace | undefined): string | null {
  const curated = place?.eventId ? curatedPhotoForEvent(place.eventId)?.imageUrl ?? null : null;
  const query = curated || !place ? null : place.eventId ? `eventId=${encodeURIComponent(place.eventId)}` : place.key ? `place=${encodeURIComponent(place.key)}` : null;
  const [fetched, setFetched] = useState<{ query: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!query) return;
    if (photoCache.has(query)) return;
    const controller = new AbortController();
    fetch(`/api/place-media?${query}`, { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<{ photos?: PlacePhoto[] }>) : { photos: [] }))
      .then((body) => {
        const url = body.photos?.[0]?.imageUrl ?? null;
        photoCache.set(query, url);
        setFetched({ query, url });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [query]);
  if (curated) return curated;
  if (!query) return null;
  return photoCache.get(query) ?? (fetched?.query === query ? fetched.url : null);
}

function PlaceCard({ place, picked, onPick }: { place: CanvasPlace; picked: boolean; onPick: () => void }) {
  const photo = usePlacePhoto(place);
  return (
    <button type="button" className={`${styles.placeCard} ${place.quiet ? styles.quiet : ''}`} aria-pressed={picked} onClick={onPick}>
      {/* eslint-disable-next-line @next/next/no-img-element -- local editorial files and checked Commons thumbnails */}
      {photo ? <img className={styles.photo} src={photo} alt="" loading="lazy" referrerPolicy="no-referrer" /> : null}
      <span className={styles.placeTop}>
        {place.focus ? <span className={styles.best}>✦ Best fit</span> : <span />}
        <span className={styles.check} aria-hidden="true">{picked ? '✓' : '+'}</span>
      </span>
      <span className={styles.placeName}>{place.name}</span>
      <span className={styles.placeMeta}>{place.country}</span>
      {(place.focus || place.reason) && <span className={styles.placeWhy}>{place.focus ?? place.reason}</span>}
    </button>
  );
}

function SpotCard({ spot, place, picked, onPick }: { spot: CanvasSpot; place: CanvasPlace | undefined; picked: boolean; onPick: () => void }) {
  const photo = usePlacePhoto(place);
  return (
    <article className={`${styles.spotCard} ${picked ? styles.spotPicked : ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- the town's photo behind its spots */}
      {photo ? <img className={styles.photo} src={photo} alt="" loading="lazy" referrerPolicy="no-referrer" /> : null}
      <button type="button" className={styles.spotPick} aria-pressed={picked} onClick={onPick} aria-label={`${picked ? 'Remove' : 'Pick'} ${spot.name}`}>
        <span className={styles.kind}><span aria-hidden="true">{SPOT_EMOJI[spot.kind]}</span> {spot.date ? new Date(`${spot.date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : SPOT_LABEL[spot.kind]}</span>
        <span className={styles.check} aria-hidden="true">{picked ? '✓' : '+'}</span>
        <span className={styles.spotName}>{spot.name}</span>
        {spot.wink ? <span className={styles.wink}>{spot.wink}</span> : spot.clash ? <span className={styles.clash}>Includes something you’d skip</span> : null}
        {spot.why && <span className={styles.spotWhy}>{spot.why}</span>}
      </button>
      <a className={styles.source} href={spot.url} target="_blank" rel="noopener noreferrer">{spot.host} ↗</a>
    </article>
  );
}

/**
 * The live canvas: places first (ranked, best fits marked), then what to do in
 * each, grouped by kind. Everything is tappable; picks feed the itinerary.
 */
export function VibeCanvas({ canvas, status, onPick }: { canvas: Canvas; status: string; onPick: (id: string) => void }) {
  const towns = [...new Set(canvas.spots.map((spot) => spot.place))];
  const placeFor = (name: string) => canvas.places.find((place) => samePlace(place.name, name));
  return (
    <div className={styles.canvas}>
      <p className={styles.status} aria-live="polite"><i aria-hidden="true" /> {status}</p>
      {canvas.places.length > 0 && (
        <section aria-label="Places">
          <h3 className={styles.heading}>Where</h3>
          <div className={styles.rail}>
            {canvas.places.map((place) => <PlaceCard key={place.id} place={place} picked={canvas.picked.includes(place.id)} onPick={() => onPick(place.id)} />)}
          </div>
        </section>
      )}
      {towns.map((town) => {
        const spots = canvas.spots.filter((spot) => spot.place === town);
        return (
          <section key={town} aria-label={`What to do in ${town}`}>
            <h3 className={styles.heading}>{town}</h3>
            {SPOT_KINDS.filter((kind) => spots.some((spot) => spot.kind === kind)).map((kind) => (
              <div key={kind}>
                <p className={styles.kindHeading}>{SPOT_LABEL[kind]}</p>
                <div className={styles.grid}>
                  {spots.filter((spot) => spot.kind === kind).sort((a, b) => (b.fit ?? 0) - (a.fit ?? 0)).map((spot) => <SpotCard key={spot.id} spot={spot} place={placeFor(town)} picked={canvas.picked.includes(spot.id)} onPick={() => onPick(spot.id)} />)}
                </div>
              </div>
            ))}
          </section>
        );
      })}
      {canvas.spots.length > 0 && <p className={styles.note}>Spots come from live web searches; each links to where it was found. Check hours and bookings with the place.</p>}
    </div>
  );
}
