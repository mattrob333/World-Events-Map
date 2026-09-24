'use client';

import { useState } from 'react';
import { approvedWikimediaUrl, type PlacePhoto } from '@/lib/place-media/media';
import { photoImageProps } from '@/lib/place-media/sources';
import { usePlacePhotos } from '@/lib/place-media/usePlacePhotos';
import styles from './destination-page.module.css';

/**
 * How a Commons photo sits in the hero. Only a wide, high-resolution landscape
 * can fill the whole frame without looking soft; anything else (portrait, or
 * small originals) is framed on the right, beside the title, and fills the frame
 * only on phones where the hero is narrow.
 */
export type HeroFrame = 'fill' | 'side';

export function heroFrameFor(photo: Pick<PlacePhoto, 'width' | 'height'>): HeroFrame {
  const { width, height } = photo;
  return width && height && width >= 1200 && width >= height * 1.25 ? 'fill' : 'side';
}

export type RemoteHero = {
  photo: PlacePhoto | null;
  frame: HeroFrame;
  loaded: boolean;
  onLoad: () => void;
  onError: () => void;
};

/**
 * The hero for destinations without a reviewed local photograph: the first
 * Commons photo for the lead occasion, or the gradient when none loads. A photo
 * that fails to load is dropped together with its credit.
 */
export function useRemoteHeroPhoto(eventId: string | null): RemoteHero {
  const { photos } = usePlacePhotos(eventId);
  const [status, setStatus] = useState<{ url: string; state: 'loaded' | 'failed' } | null>(null);
  const candidate = photos.find((photo) => approvedWikimediaUrl(photo.imageUrl, 'image') && approvedWikimediaUrl(photo.sourceUrl, 'source')) ?? null;
  const failed = candidate && status?.url === candidate.imageUrl && status.state === 'failed';
  const photo = failed ? null : candidate;
  return {
    photo,
    frame: photo ? heroFrameFor(photo) : 'fill',
    loaded: Boolean(photo && status?.url === photo.imageUrl && status.state === 'loaded'),
    onLoad: () => candidate && setStatus({ url: candidate.imageUrl, state: 'loaded' }),
    onError: () => candidate && setStatus({ url: candidate.imageUrl, state: 'failed' }),
  };
}

export function RemoteHeroPhoto({ hero, city }: { hero: RemoteHero; city: string }) {
  const { photo, frame, loaded } = hero;
  // The gradient is the loading state and the fallback; it never shows a broken box.
  if (!photo) return <div className={styles.heroFallback} aria-hidden="true" />;
  const image = photoImageProps(photo, frame === 'fill' ? 'hero' : 'heroFrame');
  return <>
    <div className={styles.heroFallback} aria-hidden="true" />
    <figure className={frame === 'fill' ? styles.mainPhoto : styles.framedPhoto} data-loaded={loaded || undefined}>
      {/* Commons thumbnails at Wikimedia's standard widths; see src/lib/place-media/sources.ts. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.photoImage}
        {...image}
        alt={`${city}: ${photo.title}`}
        fetchPriority="high"
        referrerPolicy="no-referrer"
        onLoad={hero.onLoad}
        onError={hero.onError}
      />
      <div className={styles.photoShade} aria-hidden="true" />
    </figure>
  </>;
}
