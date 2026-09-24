import { after } from 'next/server';
import { take } from '@/lib/designer/server/dailyBudget';
import { RequestTooLargeError, checkBoundary, consumeProviderCall, jsonError, jsonOk, readJson } from '@/lib/designer/server/guard';
import { callIdFrom, voiceCallLimitSeconds, voiceSessionConfig } from '@/lib/voice/session';
import { isVoiceIntent } from '@/lib/voice/tools';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// The hang-up timer runs in after(), so the function must outlive the call cap.
export const maxDuration = 300;

const CALLS_URL = 'https://api.openai.com/v1/realtime/calls';

/**
 * Starts a voice call for the Sun. The browser sends its WebRTC offer; this
 * route opens the call with OpenAI using the server key (the browser never
 * gets a key), returns the answer, and hangs the call up server-side after
 * a hard time cap. Off unless VOICE_ENABLED=1.
 *
 * The browser still controls the data channel and can change the session's
 * instructions or tools mid-call; that only affects its own call, and the
 * cost is bounded by the time cap, the per-client limiter and the daily cap.
 */
/** Whether voice is on, so the modal can skip the mic prompt when it isn't. */
export function GET() {
  return jsonOk({ enabled: process.env.VOICE_ENABLED === '1' && Boolean(process.env.OPENAI_API_KEY) });
}

export async function POST(request: Request) {
  const boundary = checkBoundary(request);
  if (boundary) return boundary;
  const apiKey = process.env.OPENAI_API_KEY;
  if (process.env.VOICE_ENABLED !== '1' || !apiKey) return jsonError(503, 'VOICE_NOT_CONFIGURED', 'Voice isn’t set up on this site yet. Type instead.');
  let body: Record<string, unknown>;
  try {
    body = ((await readJson(request, 24_000)) ?? {}) as Record<string, unknown>;
  } catch (cause) {
    if (cause instanceof RequestTooLargeError) return jsonError(413, 'TOO_LARGE', 'That request is too large.');
    return jsonError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }
  const sdp = typeof body.sdp === 'string' ? body.sdp : '';
  if (!sdp.startsWith('v=0') || sdp.length > 20_000) return jsonError(400, 'INVALID_OFFER', 'That isn’t a WebRTC offer.');
  const intent = isVoiceIntent(body.intent) ? body.intent : 'general';
  const context = typeof body.context === 'string' ? body.context : '';
  const today = typeof body.today === 'string' ? body.today : '';

  if (!consumeProviderCall(request, 'voice')) return jsonError(429, 'VOICE_COOLDOWN', 'Lots of talking just now. Give it a few minutes, or type instead.');
  if (!take('voice')) return jsonError(503, 'VOICE_DAILY_LIMIT', 'Voice is resting for today. Type instead; it works the same.');

  const form = new FormData();
  form.set('sdp', sdp);
  form.set('session', JSON.stringify(voiceSessionConfig(intent, context, today)));
  const response = await fetch(CALLS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!response?.ok) return jsonError(502, 'VOICE_UNAVAILABLE', 'Voice couldn’t start just now. Type instead.');
  const answer = await response.text().catch(() => '');
  const callId = callIdFrom(response.headers.get('location'));
  // Without a call id the cap can't be enforced, so the answer is withheld and the call never connects.
  if (!answer.startsWith('v=0') || !callId) return jsonError(502, 'VOICE_UNAVAILABLE', 'Voice couldn’t start just now. Type instead.');

  const seconds = voiceCallLimitSeconds();
  after(async () => {
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    await fetch(`${CALLS_URL}/${encodeURIComponent(callId)}/hangup`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    }).catch(() => undefined);
  });
  return jsonOk({ sdp: answer, seconds, intent });
}
