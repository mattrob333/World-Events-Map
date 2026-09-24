import { searchArtistEvents, searchTeamGames, type EventSource } from '@/lib/designer/concerts';
import { readWindow, textList } from '@/lib/designer/music-input';
import { curatedOccasions } from '@/lib/designer/occasions';
import { RequestTooLargeError, checkBoundary, consumeProviderCall, jsonError, jsonOk, readJson } from '@/lib/designer/server/guard';
import { rankTripIdeas, type TripIdeasResponse } from '@/lib/designer/tripIdeas';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 45;

/** Trip ideas where the traveler's artists, festivals, and teams line up, over the next year by default. */
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
  const artists = textList(body.artists, 5);
  const teams = textList(body.teams, 4);
  if (!artists.length && !teams.length) return jsonError(400, 'TASTE_REQUIRED', 'Add artists or teams first.');
  const today = new Date().toISOString().slice(0, 10);
  const window = readWindow(body);
  const startDate = window.startDate ?? today;
  const endDate = window.endDate ?? new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
  const homeCity = typeof body.homeCity === 'string' ? body.homeCity.slice(0, 80) : undefined;

  const keys = { ticketmaster: process.env.TICKETMASTER_API_KEY || undefined, seatgeek: process.env.SEATGEEK_CLIENT_ID || undefined };
  const sources = (Object.keys(keys) as EventSource[]).filter((key) => keys[key]);
  const fetchedAt = new Date().toISOString();
  if (!sources.length || !consumeProviderCall(request, 'concerts')) return jsonOk({ sources: [], ideas: [], fetchedAt } satisfies TripIdeasResponse);
  const [music, games] = await Promise.all([
    artists.length ? searchArtistEvents({ artists, startDate, endDate }, keys) : Promise.resolve([]),
    teams.length ? searchTeamGames({ teams, startDate, endDate }, keys) : Promise.resolve([]),
  ]);
  const ideas = rankTripIdeas([...music, ...games], { occasions: curatedOccasions({ startDate, endDate }), excludeCity: homeCity, limit: 8 });
  return jsonOk({ sources, ideas, fetchedAt } satisfies TripIdeasResponse);
}
