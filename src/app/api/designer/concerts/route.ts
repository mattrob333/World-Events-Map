import { EventFeedBudgetError, MAX_CONCERT_ARTISTS, concertLinks, searchArtistEvents, type ConcertResult, type EventSource } from '@/lib/designer/concerts';
import { readTaste, readWindow, textList, listenerSummary } from '@/lib/designer/music-input';
import { RequestTooLargeError, checkBoundary, consumeProviderCall, jsonError, jsonOk, readJson } from '@/lib/designer/server/guard';
import { jevBudgetAvailable, jevConfigured, jevEventFit } from '@/lib/designer/server/jevMusic';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 45;

/**
 * Where a traveler's artists are playing: tour dates, festivals with them on
 * the bill, and tribute acts. Worldwide by default (for the map), or near a
 * city. Real provider listings only; search links otherwise.
 */
export async function POST(request: Request) {
  const boundary = checkBoundary(request);
  if (boundary) return boundary;
  let body: Record<string, unknown>;
  try {
    body = ((await readJson(request, 6000)) ?? {}) as Record<string, unknown>;
  } catch (cause) {
    if (cause instanceof RequestTooLargeError) return jsonError(413, 'TOO_LARGE', 'That request is too large.');
    return jsonError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }
  const artists = textList(body.artists, MAX_CONCERT_ARTISTS);
  if (!artists.length) return jsonError(400, 'ARTISTS_REQUIRED', 'Connect Spotify or add some music first.');
  const city = typeof body.city === 'string' && body.city.trim() ? body.city.trim().slice(0, 60).split(',')[0] : undefined;
  const window = readWindow(body);

  const links = concertLinks(artists, city);
  const fetchedAt = new Date().toISOString();
  const keys = { ticketmaster: process.env.TICKETMASTER_API_KEY || undefined, seatgeek: process.env.SEATGEEK_CLIENT_ID || undefined };
  const sources = (Object.keys(keys) as EventSource[]).filter((key) => keys[key]);
  if (!sources.length || !consumeProviderCall(request, 'concerts')) {
    return jsonOk({ source: 'links', sources: [], fetchedAt, concerts: [], links } satisfies ConcertResult);
  }
  let concerts: ConcertResult['concerts'];
  try {
    concerts = await searchArtistEvents({ artists, city, ...window }, keys);
  } catch (cause) {
    // Today's event-feed budget is spent: the same honest links-only answer as an unconfigured feed.
    if (cause instanceof EventFeedBudgetError) return jsonOk({ source: 'links', sources: [], fetchedAt, concerts: [], links } satisfies ConcertResult);
    throw cause;
  }
  // Jev only judges tribute acts here: an artist's own show is a fit by definition.
  if (jevConfigured() && jevBudgetAvailable() && body.taste && concerts.some((c) => c.kind === 'tribute') && consumeProviderCall(request, 'jev')) {
    const tributes = concerts.filter((c) => c.kind === 'tribute');
    const fit = await jevEventFit(listenerSummary(readTaste(body.taste)), tributes);
    concerts = concerts.map((c) => (fit.has(c.id) ? { ...c, fit: fit.get(c.id) } : c));
  }
  return jsonOk({ source: sources.length > 1 ? 'mixed' : sources[0], sources, fetchedAt, concerts, links } satisfies ConcertResult);
}
