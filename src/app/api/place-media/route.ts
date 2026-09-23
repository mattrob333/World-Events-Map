import { NextResponse } from 'next/server';
import { EVENT_INDEX } from '@/lib/data/events';
import { isRecentEventArchive, selectCommonsPhotos, type PlacePhoto } from '@/lib/place-media/media';
import { curatedPhotoForEvent } from '@/lib/place-media/curated';
import type { EventCategory, WorldEvent } from '@/lib/types';

export const runtime = 'nodejs';

const CACHE_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { expires: number; photos: PlacePhoto[] }>();
const inflight = new Map<string, Promise<PlacePhoto[]>>();
// These are editorial search hints, never user-supplied query strings. Generic
// calendar names often return buildings instead of the travel scene itself.
const EVENT_SEARCH: Record<string, string> = {
  'monaco-yacht-show': 'Monaco Yacht Show',
};
const PLACE_SEARCH: Record<string, string> = {
  'aspen-christmas-week': 'Aspen skiing Colorado',
  'niseko-january-powder': 'Niseko skiing Japan',
  'galapagos-cool-season': 'Puerto Ayora Galapagos sunset',
  'kyoto-cherry-blossom': 'Kyoto cherry blossom sakura',
};
const PLACE_QUERY: Record<EventCategory, string> = {
  art: 'art exhibition', music: 'concert festival', motorsport: 'racing circuit',
  sailing: 'yacht sail', ski: 'ski snow', culinary: 'food restaurant',
  fashion: 'fashion runway', wellness: 'spa wellness', safari: 'wildlife safari',
  equestrian: 'horse racing', film: 'film festival', design: 'design exhibition',
  golf: 'golf course', tennis: 'tennis court', nature: 'nature landscape',
  cultural: 'festival celebration', gala: 'gala ball',
};

async function searchCommons(query: string, event: WorldEvent, subject: 'event' | 'place'): Promise<PlacePhoto[]> {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.search = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', generator: 'search',
    gsrsearch: query, gsrnamespace: '6', gsrlimit: '10',
    prop: 'imageinfo', iiprop: 'url|mime|extmetadata', iiurlwidth: '1000',
    iiextmetadatafilter: 'Artist|Credit|LicenseShortName|DateTimeOriginal',
  }).toString();
  const response = await fetch(url, {
    signal: AbortSignal.timeout(4500),
    headers: { 'User-Agent': 'MeridianTravelPreview/0.1 (https://github.com/mattrob333/World-Events-Map)' },
    cache: 'no-store',
  });
  if (!response.ok || Number(response.headers.get('content-length') ?? 0) > 500_000) return [];
  const raw = await response.text();
  if (raw.length > 500_000) return [];
  const payload = JSON.parse(raw) as { query?: { pages?: unknown } };
  return selectCommonsPhotos(payload.query?.pages, event, subject);
}

export async function GET(request: Request) {
  const eventId = new URL(request.url).searchParams.get('eventId');
  if (!eventId || eventId.length > 100 || !/^[a-z0-9-]+$/.test(eventId)) {
    return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
  }
  const event = EVENT_INDEX.get(eventId);
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const cached = cache.get(eventId);
  if (cached && cached.expires > Date.now()) return NextResponse.json({ photos: cached.photos, source: 'Wikimedia Commons' });

  let pending = inflight.get(eventId);
  if (!pending) {
    pending = loadPhotos(event);
    inflight.set(eventId, pending);
  }
  const photos = await pending;
  inflight.delete(eventId);

  if (cache.size >= 200) cache.delete(cache.keys().next().value!);
  cache.set(eventId, { photos, expires: Date.now() + (photos.length ? CACHE_MS : 5 * 60 * 1000) });
  return NextResponse.json({ photos, source: 'Wikimedia Commons' }, {
    headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' },
  });
}

async function loadPhotos(event: WorldEvent): Promise<PlacePhoto[]> {
  const curated = curatedPhotoForEvent(event.id);
  const photos = (await searchCommons(EVENT_SEARCH[event.id] ?? `${event.name} ${event.city}`, event, 'event').catch(() => []))
    .filter((photo) => isRecentEventArchive(photo, event));
  if (photos.length >= 4) return curated ? [curated, ...photos.filter((photo) => photo.sourceUrl !== curated.sourceUrl).slice(0, 4)] : photos;
  const placeQuery = PLACE_SEARCH[event.id] ?? `${event.city} ${PLACE_QUERY[event.category]}`;
  const place = await searchCommons(placeQuery, event, 'place').catch(() => []);
  if (event.category === 'ski') {
    place.sort((a, b) => Number(/ski|snowboard|gondola|chairlift|powder/i.test(b.title)) -
      Number(/ski|snowboard|gondola|chairlift|powder/i.test(a.title)));
  }
  const existing = new Set([...(curated ? [curated.sourceUrl] : []), ...photos.map((photo) => photo.sourceUrl)]);
  const supplements = [...photos.filter((photo) => photo.sourceUrl !== curated?.sourceUrl),
    ...place.filter((photo) => !existing.has(photo.sourceUrl))];
  return curated ? [curated, ...supplements.slice(0, 4)] : supplements.slice(0, 5);
}
