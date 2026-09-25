/**
 * GET /api/feed/latest
 *
 * The home page's live strip: fresh headlines from the nightly news intake
 * that name a place on our calendar. Read-only, takes no input, calls no
 * paid service, and is cached at the edge for ten minutes.
 */

import { NextResponse } from 'next/server';
import { EVENTS } from '@/lib/data/events';
import { curatedPhotoForEvent } from '@/lib/place-media/curated';
import { indexDestinations } from '@/lib/pulse';
import { latestStories, type LatestStory } from '@/lib/vibe/latestStories';
import { placeForEvent, placeIndex, type Place } from '@/lib/vibe/places';
import { feedIndex } from '@/lib/vibe/server/feedIndex';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

let places: Place[] | null = null;
let info: Map<string, { key: string; name: string; country: string; photo: LatestStory['photo']; href: string | null }> | null = null;

function placeInfo() {
  places ??= placeIndex(EVENTS);
  if (info) return { places, info };
  const destinations = indexDestinations(EVENTS);
  info = new Map(places.map((place) => [place.key, { key: place.key, name: place.name, country: place.country, photo: null, href: null }]));
  for (const event of EVENTS) {
    const place = placeForEvent(event, places);
    const entry = place ? info.get(place.key) : undefined;
    if (!entry) continue;
    const photo = curatedPhotoForEvent(event.id);
    if (photo && !entry.photo) entry.photo = { imageUrl: photo.imageUrl, credit: `${photo.credit} · ${photo.license}` };
    const slug = destinations.byEventId.get(event.id)?.slug;
    if (slug && !entry.href) entry.href = `/destinations/${slug}`;
  }
  return { places, info };
}

export async function GET() {
  const { places: all, info: byKey } = placeInfo();
  const index = await feedIndex(all);
  const stories = index.status.state === 'ok' ? latestStories(index.byPlace, byKey, new Date()) : [];
  return NextResponse.json(
    { state: index.status.state, stories, sources: 'Headlines from the dope.travel news intake; each links to its publisher.' },
    { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=1800' } },
  );
}
