import { PlaylistInputError, readPublicPlaylist, spotifyAppConfigured } from '@/lib/designer/server/spotifyApp';
import { RequestTooLargeError, checkBoundary, consumeProviderCall, jsonError, jsonOk, readJson } from '@/lib/designer/server/guard';
import { PlaylistUnavailableError } from '@/lib/designer/spotifyRead';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

/** Reads a public Spotify playlist link into a listening summary. Nothing is stored. */
export async function POST(request: Request) {
  const boundary = checkBoundary(request);
  if (boundary) return boundary;
  let link = '';
  try {
    const body = (await readJson(request, 2000)) as { link?: unknown } | null;
    link = typeof body?.link === 'string' ? body.link.slice(0, 300) : '';
  } catch (cause) {
    if (cause instanceof RequestTooLargeError) return jsonError(413, 'TOO_LARGE', 'That request is too large.');
    return jsonError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }
  if (!spotifyAppConfigured()) return jsonError(503, 'NOT_CONFIGURED', 'Reading playlist links isn’t set up for this app yet. Use Connect Spotify instead.');
  if (!consumeProviderCall(request, 'spotify')) return jsonError(429, 'RATE_LIMITED', 'Too many playlists at once. Try again in a few minutes.');
  try {
    return jsonOk({ listening: await readPublicPlaylist(link) });
  } catch (cause) {
    if (cause instanceof PlaylistInputError) return jsonError(400, 'INVALID_PLAYLIST', cause.message);
    if (cause instanceof PlaylistUnavailableError) return jsonError(502, 'PLAYLIST_UNAVAILABLE', cause.message);
    console.error('playlist read failed', cause instanceof Error ? cause.message : cause);
    return jsonError(502, 'PLAYLIST_UNAVAILABLE', 'Spotify didn’t respond. Try again in a minute.');
  }
}
