import { MAX_RAMBLE_CHARS, parseProfileLocally, type ParsedProfile } from '@/lib/designer/profile';
import { designerAiConfigured, parseProfileWithClaude } from '@/lib/designer/server/claude';
import { takeShared } from '@/lib/designer/server/sharedBudget';
import { RequestTooLargeError, checkBoundary, consumeAiCall, jsonError, jsonOk, readJson } from '@/lib/designer/server/guard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Sorts a spoken ramble into a traveler profile. Nothing is stored here: the
 * transcript goes to the AI parser (when an operator enabled it) and the
 * profile comes straight back to the device.
 */
export async function POST(request: Request) {
  const boundary = checkBoundary(request);
  if (boundary) return boundary;

  let body: unknown;
  try {
    body = await readJson(request, MAX_RAMBLE_CHARS * 4 + 1000);
  } catch (cause) {
    if (cause instanceof RequestTooLargeError) return jsonError(413, 'TOO_LARGE', 'That ramble is too long. Keep it under a few minutes.');
    return jsonError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }
  const transcript = (body as { transcript?: unknown } | null)?.transcript;
  if (typeof transcript !== 'string' || transcript.trim().length < 10) {
    return jsonError(400, 'TRANSCRIPT_REQUIRED', 'Say or type a few sentences about yourself first.');
  }
  const text = transcript.trim().slice(0, MAX_RAMBLE_CHARS);

  const local = (notice?: string): Response =>
    jsonOk({ profile: parseProfileLocally(text), engine: 'on-device', notice } satisfies ParsedProfile & { notice?: string });

  if (!designerAiConfigured()) return local();
  if (!consumeAiCall(request)) return local('AI sorting is busy for you right now, so this was sorted on the device.');
  if (!(await takeShared('designerAi'))) return local('AI sorting is resting for today, so this was sorted on the device.');
  try {
    const profile = await parseProfileWithClaude(text);
    return jsonOk({ profile, engine: 'claude' } satisfies ParsedProfile);
  } catch (cause) {
    console.error('designer profile parse failed', cause instanceof Error ? cause.message : cause);
    return local('AI sorting was unavailable, so this was sorted on the device.');
  }
}
