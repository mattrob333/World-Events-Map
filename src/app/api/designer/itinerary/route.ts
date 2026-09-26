import { InputError, validateComposeBody } from '@/lib/designer/validate';
import { applyCuration, composeLocally, groupTags } from '@/lib/designer/itinerary';
import { curateItineraryWithClaude, designerAiConfigured } from '@/lib/designer/server/claude';
import { takeShared } from '@/lib/designer/server/sharedBudget';
import { RequestTooLargeError, checkBoundary, consumeAiCall, jsonError, jsonOk, readJson } from '@/lib/designer/server/guard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 90;

/**
 * Builds the first draft of a group itinerary. The timeline and every idea
 * card come from dope.travel's catalog; the AI (when enabled) only reorders
 * cards within each slot and writes the day headlines.
 */
export async function POST(request: Request) {
  const boundary = checkBoundary(request);
  if (boundary) return boundary;

  let parsed: ReturnType<typeof validateComposeBody>;
  try {
    parsed = validateComposeBody(await readJson(request, 24_000));
  } catch (cause) {
    if (cause instanceof RequestTooLargeError) return jsonError(413, 'TOO_LARGE', 'That request is too large.');
    if (cause instanceof InputError) return jsonError(400, 'INVALID_TRIP', cause.message);
    return jsonError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }

  const base = composeLocally(parsed.input);
  if (!designerAiConfigured()) return jsonOk({ itinerary: base });
  if (!consumeAiCall(request)) {
    return jsonOk({ itinerary: base, notice: 'The AI designer is busy for you right now, so this draft was built on the device.' });
  }
  if (!(await takeShared('designerAi'))) {
    return jsonOk({ itinerary: base, notice: 'The AI designer is resting for today, so this draft was built on the device.' });
  }
  try {
    const curation = await curateItineraryWithClaude(base, parsed.profileNotes);
    return jsonOk({ itinerary: applyCuration(base, curation, groupTags(base.participants)) });
  } catch (cause) {
    console.error('designer itinerary curation failed', cause instanceof Error ? cause.message : cause);
    return jsonOk({ itinerary: base, notice: 'The AI designer was unavailable, so this draft was built on the device.' });
  }
}
