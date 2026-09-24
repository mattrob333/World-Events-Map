import { isIsoDate } from '@/lib/designer/itinerary';
import { RequestTooLargeError, checkBoundary, consumeProviderCall, jsonError, jsonOk, readJson } from '@/lib/designer/server/guard';
import { researchDestination, type ResearchRequest } from '@/lib/research/destination';

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
 * per-run cap; without a token every section says it isn't connected.
 */
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
  if (process.env.TREG_TOKEN && !consumeProviderCall(request, 'research')) {
    return jsonError(429, 'RESEARCH_COOLDOWN', 'Research just ran a few times. Give it ten minutes.');
  }
  const research = await researchDestination(req, {
    log: (receipt) => console.info('treg research call', receipt.endpoint, receipt.callId, receipt.costMicro),
  });
  return jsonOk(research);
}
