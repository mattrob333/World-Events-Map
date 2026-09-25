import { RequestTooLargeError, checkBoundary, consumeProviderCall, jsonError, jsonOk, readJson } from '@/lib/designer/server/guard';
import { EVENTS } from '@/lib/data/events';
import { recommendDestinations } from '@/lib/discovery/recommend';
import { take } from '@/lib/designer/server/dailyBudget';
import { askJev, jevConfigured, stateHash } from '@/lib/jev/client';
import { TRIP_ROUTER_CONTRACT, routeTripRequest, tripRouterQuestions, tripRouterState, type TripRequestFacts } from '@/lib/jev/contracts/tripRouter';
import { storeReceipts } from '@/lib/jev/receipts';
import { indexDestinations } from '@/lib/pulse';
import { readTrip } from '@/lib/voice/tripBrief';
import { tripChecklist } from '@/lib/voice/vibeChecklist';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * What is the traveler asking for? trip-router@1 (Jev) picks the intent and
 * trip type; code picks the route: recommend destinations from the curated
 * calendar, open the planner for a named place, or ask one follow-up.
 * Without Jev, plain word rules answer and the response says so.
 */
export async function POST(request: Request) {
  const boundary = checkBoundary(request);
  if (boundary) return boundary;
  let body: Record<string, unknown>;
  try {
    body = ((await readJson(request, 3000)) ?? {}) as Record<string, unknown>;
  } catch (cause) {
    if (cause instanceof RequestTooLargeError) return jsonError(413, 'TOO_LARGE', 'That request is too large.');
    return jsonError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }
  const text = typeof body.text === 'string' ? body.text.replace(/\s+/g, ' ').trim().slice(0, 1000) : '';
  if (text.length < 3) return jsonError(400, 'EMPTY', 'Say what you’re after first.');
  const today = typeof body.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : new Date().toISOString().slice(0, 10);

  const brief = readTrip(text, today);
  const found = brief.place;
  const when = brief.when;
  const checks = Object.fromEntries(tripChecklist(text).map((item) => [item.key, item.done]));
  const facts: TripRequestFacts = {
    text,
    placeFound: found ? [found.place, found.region].filter(Boolean).join(', ') : null,
    regionFound: brief.wheres.length ? brief.wheres.map((where) => where.label).join(', ') : null,
    whenFound: Boolean(checks.when),
    whoFound: Boolean(checks.who),
    hasProfile: body.hasProfile === true,
  };

  const state = tripRouterState(facts);
  // No key: word rules, and no limiter token or receipt spent on a call that can't happen.
  const allowed = jevConfigured() && consumeProviderCall(request, 'jev') && take('jev');
  const result = allowed ? await askJev(state, tripRouterQuestions) : null;
  const decided = routeTripRequest(facts, result?.ok ? result.answers : null);

  if (result) {
    void storeReceipts([{
      contract: TRIP_ROUTER_CONTRACT, subject: 'request', stateHash: stateHash(state), model: result.ok ? result.model : null,
      latencyMs: result.latencyMs, answers: result.ok ? (result.answers as never) : null, failure: result.ok ? null : result.failure,
      route: decided.route, actionTaken: true, createdAt: new Date().toISOString(),
    }]);
  }

  const decidedBy = result?.ok ? 'jev' : 'rules';
  if (decided.route === 'follow_up') return jsonOk({ route: 'follow_up', question: decided.question, decidedBy });
  if (decided.route === 'plan') {
    const place = found ? { ...found, ...(when.start ? { start: when.start } : {}), ...(when.nights ? { nights: when.nights } : {}), ...(brief.crew ? { who: brief.crew.label } : {}) } : null;
    return jsonOk({ route: 'plan', place, tripType: decided.tripType, decidedBy });
  }

  const index = indexDestinations(EVENTS, today);
  const tripType = decided.tripType ?? brief.tripType;
  const recommendations = recommendDestinations(EVENTS, today, tripType, { ...(when.month ? { within: when.month } : {}), where: brief.wheres }).map(({ event, why }) => ({
    id: event.id,
    name: event.name,
    city: event.city,
    country: event.country,
    start: event.start,
    end: event.end,
    when: why.when,
    planBy: why.planBy?.label ?? null,
    reason: why.reason ?? null,
    slug: index.byEventId.get(event.id)?.slug ?? null,
  }));
  return jsonOk({ route: 'recommend', tripType, recommendations, where: brief.wheres.map((where) => where.label), crew: brief.crew?.label ?? null, nights: when.nights ?? null, month: when.month?.from.slice(0, 7) ?? null, decidedBy, source: 'dope.travel curated calendar' });
}
