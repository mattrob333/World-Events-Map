import { EventFeedBudgetError, searchCityScene, type EventSource, type LiveEvent, type SceneResponse } from '@/lib/designer/concerts';
import { listenerSummary, readTaste, readWindow } from '@/lib/designer/music-input';
import { publicScene, scenePlaybook, sceneSearchLinks } from '@/lib/designer/scene';
import { RequestTooLargeError, checkBoundary, consumeProviderCall, jsonError, jsonOk, readJson } from '@/lib/designer/server/guard';
import { jevBudgetAvailable, jevConfigured, jevEventFit } from '@/lib/designer/server/jevMusic';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 45;

/**
 * "Where should I go for live music in {city}?" The playbook comes from the
 * traveler's taste; events come from real providers for that city and date
 * window; Jev (when configured) scores each event's fit; every scene also
 * gets map searches so there is always a way in.
 */
export async function POST(request: Request) {
  const boundary = checkBoundary(request);
  if (boundary) return boundary;
  let body: Record<string, unknown>;
  try {
    body = ((await readJson(request, 8000)) ?? {}) as Record<string, unknown>;
  } catch (cause) {
    if (cause instanceof RequestTooLargeError) return jsonError(413, 'TOO_LARGE', 'That request is too large.');
    return jsonError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }
  const city = typeof body.city === 'string' ? body.city.trim().slice(0, 60).split(',')[0] : '';
  if (city.length < 2) return jsonError(400, 'CITY_REQUIRED', 'Choose a city.');
  const taste = readTaste(body.taste);
  const playbook = scenePlaybook(taste);
  if (!playbook.length) return jsonError(400, 'TASTE_REQUIRED', 'Add some music you love first.');

  const scenes = playbook.map((scene) => ({ ...publicScene(scene), links: sceneSearchLinks(scene, city) }));
  const keys = { ticketmaster: process.env.TICKETMASTER_API_KEY || undefined, seatgeek: process.env.SEATGEEK_CLIENT_ID || undefined };
  const sources = (Object.keys(keys) as EventSource[]).filter((key) => keys[key]);
  const fetchedAt = new Date().toISOString();
  let events: LiveEvent[] = [];
  let judged = false;
  let listed = sources;
  if (sources.length && consumeProviderCall(request, 'concerts')) {
    try {
      events = await searchCityScene({ city, ...readWindow(body), scenes: playbook.map((scene) => scene.key) }, keys);
    } catch (cause) {
      if (!(cause instanceof EventFeedBudgetError)) throw cause;
      // Today's event-feed budget is spent: no listings, so claim no sources.
      listed = [];
    }
    if (events.length && jevConfigured() && jevBudgetAvailable() && consumeProviderCall(request, 'jev')) {
      const fit = await jevEventFit(listenerSummary(taste), events);
      if (fit.size) {
        judged = true;
        events = events
          .map((event) => (fit.has(event.id) ? { ...event, fit: fit.get(event.id) } : event))
          // Jev said "not their music": drop it rather than pad the list.
          .filter((event) => event.fit === undefined || event.fit >= 0.34)
          .sort((a, b) => (b.fit ?? 0.5) - (a.fit ?? 0.5) || a.date.localeCompare(b.date));
      }
    }
  }
  return jsonOk({ city, fetchedAt, sources: listed, judged, scenes, events } satisfies SceneResponse);
}
