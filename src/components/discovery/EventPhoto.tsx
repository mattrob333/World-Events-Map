'use client';

import { useState } from 'react';
import { curatedPhotoForEvent } from '@/lib/place-media/curated';
import { photoImageProps, type PhotoSlot } from '@/lib/place-media/sources';
import { usePlacePhotos } from '@/lib/place-media/usePlacePhotos';

/**
 * A card's background photo: our reviewed editorial photo for the event, else
 * the first licensed Commons photo of the place. Renders nothing until one
 * exists, so the card's own gradient shows instead of a broken image.
 */
export function EventPhoto({ eventId, className, slot = 'card' }: { eventId: string; className?: string; slot?: PhotoSlot }) {
  const curated = curatedPhotoForEvent(eventId);
  const { photos } = usePlacePhotos(curated ? null : eventId);
  const photo = curated ?? photos[0] ?? null;
  const [failed, setFailed] = useState<string | null>(null);
  if (!photo || failed === photo.imageUrl) return null;
  return (
    // Local editorial files and checked Commons thumbnails.
    // eslint-disable-next-line @next/next/no-img-element
    <img className={className} {...photoImageProps(photo, slot)} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(photo.imageUrl)} />
  );
}
