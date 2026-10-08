import photos from './curated.json';
import festivals from './festival-photos.json';
import type { PlacePhoto } from './media';

// Each local image was visually reviewed against the named scene and its
// Commons source. The ledger in docs/EDITORIAL-PHOTO-CREDITS.md records the
// creator, license and archive year; no future event is represented as live.
const CURATED_PHOTOS = photos as Record<string, PlacePhoto>;
// Electronic festivals: each Commons photo was reviewed the same way, then
// linked at a standard thumbnail width rather than stored here. Titles say
// what the frame shows; a place photo never claims to be the festival.
const FESTIVAL_PHOTOS = festivals as Record<string, PlacePhoto>;

export function curatedPhotoForEvent(eventId: string): PlacePhoto | null {
  return CURATED_PHOTOS[eventId] ?? FESTIVAL_PHOTOS[eventId] ?? null;
}

export function photoArchiveLabel(photo: PlacePhoto): string {
  const year = photo.photographed?.match(/(?:19|20)\d{2}/)?.[0];
  if (photo.subject === 'event') return year ? `${year} event archive` : 'Event archive';
  return year ? `Place photo · ${year}` : 'Place photo';
}

export function curatedPhotoEntries(): Array<[string, PlacePhoto]> {
  return Object.entries(CURATED_PHOTOS);
}

export function festivalPhotoEntries(): Array<[string, PlacePhoto]> {
  return Object.entries(FESTIVAL_PHOTOS);
}
