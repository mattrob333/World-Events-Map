import { MAX_CONCERT_ARTISTS, concertLinks, searchTicketmaster, type ConcertResult } from '@/lib/designer/concerts';
import { isIsoDate } from '@/lib/designer/itinerary';
import { RequestTooLargeError, checkBoundary, consumeProviderCall, jsonError, jsonOk, readJson } from '@/lib/designer/server/guard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const text = (value: unknown, max: number) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined);

/** Upcoming shows (and tribute acts) for a traveler's top artists. */
export async function POST(request: Request) {
  const boundary = checkBoundary(request);
  if (boundary) return boundary;
  let body: Record<string, unknown>;
  try {
    body = ((await readJson(request, 4000)) ?? {}) as Record<string, unknown>;
  } catch (cause) {
    if (cause instanceof RequestTooLargeError) return jsonError(413, 'TOO_LARGE', 'That request is too large.');
    return jsonError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }
  const artists = [...new Set((Array.isArray(body.artists) ? body.artists : []).map((a) => text(a, 80)).filter((a): a is string => Boolean(a)))].slice(0, MAX_CONCERT_ARTISTS);
  if (!artists.length) return jsonError(400, 'ARTISTS_REQUIRED', 'Connect Spotify or add some music first.');
  const city = text(body.city, 60)?.split(',')[0];
  const startDate = typeof body.startDate === 'string' && isIsoDate(body.startDate) ? body.startDate : undefined;
  const endDate = typeof body.endDate === 'string' && isIsoDate(body.endDate) ? body.endDate : undefined;

  const links = concertLinks(artists, city);
  const fetchedAt = new Date().toISOString();
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey || !consumeProviderCall(request, 'concerts')) {
    return jsonOk({ source: 'links', fetchedAt, concerts: [], links } satisfies ConcertResult);
  }
  const concerts = await searchTicketmaster({ artists, city, startDate, endDate }, apiKey);
  return jsonOk({ source: 'ticketmaster', fetchedAt, concerts, links } satisfies ConcertResult);
}
