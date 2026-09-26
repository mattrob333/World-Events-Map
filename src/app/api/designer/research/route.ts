import { isIsoDate } from '@/lib/designer/itinerary';
import { RequestTooLargeError, checkBoundary, consumeProviderCall, jsonError, jsonOk, readJson } from '@/lib/designer/server/guard';
import { researchCacheMisses, researchDestination, type ResearchRequest } from '@/lib/research/destination';
import { requireMember } from '@/lib/platform/server/member';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const text = (value: unknown, min: number, max: number): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length >= min && clean.length <= max && !/[<>{}\\\u0000-\u001f]/.test(clean) ? clean : undefined;
};
const iata = (value: unknown) => (typeof value === 'string' && /^[A-Z]{3}$/.test(value) ? value : undefined);

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Live destination research for the trip canvas: top spots, hidden gems,
 * Tripadvisor and Yelp, recent Instagram and TikTok posts, events, and
 * fares when both airports are known. Paid calls go through Treg with a
 * per-run cap and a daily cap; without a token every section says it isn't
 * connected. Flights only for a plausible trip: departing after today and
 * within ~11 months, 1–30 nights (so date variants can't be minted freely).
 */
export async function POST(request: Request) {
  // Members only: this route spends money or runs a search.
  const member = await requireMember(request);
  if (member instanceof Response) return member;
  const boundary = checkBoundary(request);
  if (boundary) return boundary;
  let body: Record<string, unknown>;
  try {
    body = ((await readJson(request, 4000)) ?? {}) as Record<string, unknown>;
  } catch (cause) {
    if (cause instanceof RequestTooLargeError) return jsonError(413, 'TOO_LARGE', 'That request is too large.');
    return jsonError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }
  const name = text(body.name, 2, 60);
  if (!name) return jsonError(400, 'PLACE_REQUIRED', 'Choose a place to research.');
  const req: ResearchRequest = {
    name,
    region: text(body.region, 2, 60),
    food: text(body.food, 2, 40),
    scene: text(body.scene, 2, 40),
  };
  const from = iata(body.from);
  const to = iata(body.to);
  const depart = typeof body.depart === 'string' && isIsoDate(body.depart) ? body.depart : undefined;
  const nights = typeof body.nights === 'number' && Number.isInteger(body.nights) && body.nights >= 1 && body.nights <= 30 ? body.nights : undefined;
  if (from && to && from !== to && depart && nights) {
    const today = new Date().toISOString().slice(0, 10);
    // Google Flights sells about eleven months out; past dates have no fares.
    if (depart > today && depart <= addDays(today, 330)) req.flight = { from, to, depart, return: addDays(depart, nights) };
  }
  // Only new paid work spends a limiter token: reopening a cached place (a
  // guest's copy, a refresh) never gets a 429. Total spend is bounded by the
  // daily budget in destination.ts, not by this per-client limiter.
  // On the live site, visitor-triggered paid research stays off until the daily
  // budget is durable (it's per server instance today): RESEARCH_PUBLIC=on opens
  // it. Places already cached still load; the scheduled sweep is unaffected.
  const misses = process.env.TREG_TOKEN ? researchCacheMisses(req) : 0;
  if (misses > 0 && process.env.VERCEL_ENV === 'production' && process.env.RESEARCH_PUBLIC !== 'on') {
    return jsonError(503, 'RESEARCH_PAUSED', 'Live look-arounds are switched off on the public site for now. The ideas below still open real searches.');
  }
  if (misses > 0 && !consumeProviderCall(request, 'research')) {
    return jsonError(429, 'RESEARCH_COOLDOWN', 'New research ran a few times from your connection. Give it ten minutes; places already looked up still load.');
  }
  const research = await researchDestination(req, {
    log: (receipt) => console.info('treg research call', receipt.endpoint, receipt.callId, receipt.costMicro),
  });
  return jsonOk(research);
}
