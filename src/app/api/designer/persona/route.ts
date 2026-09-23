import { listenerSummary, readTaste, textList } from '@/lib/designer/music-input';
import { RequestTooLargeError, checkBoundary, consumeProviderCall, jsonError, jsonOk, readJson } from '@/lib/designer/server/guard';
import { jevConfigured, jevPersona } from '@/lib/designer/server/jevMusic';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Jev's read of a listener: the room they want, energy, cover-band and festival appetite. */
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
  const taste = readTaste(body.taste);
  if (!taste.genres.length && !taste.topArtists?.length) return jsonError(400, 'TASTE_REQUIRED', 'Add some music you love first.');
  if (!jevConfigured()) return jsonOk({ persona: null, reason: 'not_configured' });
  if (!consumeProviderCall(request, 'jev')) return jsonOk({ persona: null, reason: 'rate_limited' });
  const persona = await jevPersona(
    listenerSummary(taste, {
      listeningHours: typeof body.listeningHours === 'string' ? body.listeningHours.slice(0, 80) : undefined,
      playlistHabits: textList(body.playlistHabits, 6, 40),
    }),
  );
  return jsonOk({ persona, reason: persona ? null : 'unavailable' });
}
