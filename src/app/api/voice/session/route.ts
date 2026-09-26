import { after } from 'next/server';
import { takeShared } from '@/lib/designer/server/sharedBudget';
import { RequestTooLargeError, checkBoundary, consumeProviderCall, jsonError, jsonOk, readJson } from '@/lib/designer/server/guard';
import { liveSessionConfig, voiceCallLimitSeconds } from '@/lib/voice/session';
import { isVoiceIntent } from '@/lib/voice/tools';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// The hang-up timer runs in after(), so the function must outlive the call cap.
export const maxDuration = 300;

const LIVE_URL = 'https://api.openai.com/v1/live/sessions';

/**
 * Starts a GPT-Live voice session for the Vibe stage. The browser sends its
 * WebRTC offer; this route opens the session with OpenAI using the server key
 * (the browser never gets a key), returns the answer, and hangs the session up
 * server-side after a hard time cap. Off unless VOICE_ENABLED=1.
 *
 * GPT-Live talks; its Responses backend reasons, searches the web (trip
 * canvas only) and calls this intent's tools, which run in the browser.
 * Cost is bounded by the time cap, the per-client limiter and the daily cap.
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
  const profile = typeof body.profile === 'string' ? body.profile : '';
  const today = typeof body.today === 'string' ? body.today : '';

  if (!consumeProviderCall(request, 'voice')) return jsonError(429, 'VOICE_COOLDOWN', 'Lots of talking just now. Give it a few minutes, or type instead.');
  if (!(await takeShared('voice'))) return jsonError(503, 'VOICE_DAILY_LIMIT', 'Voice is resting for today. Type instead; it works the same.');

  const response = await fetch(LIVE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ session: liveSessionConfig(intent, context, profile, today), transport: { type: 'webrtc', sdp } }),
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  }).catch(() => null);
  if (!response?.ok) return jsonError(502, 'VOICE_UNAVAILABLE', 'Voice couldn’t start just now. Type instead.');
  const created = (await response.json().catch(() => null)) as { session?: { id?: unknown }; transport?: { sdp?: unknown } } | null;
  const answer = typeof created?.transport?.sdp === 'string' ? created.transport.sdp : '';
  const sessionId = sessionIdFrom(created?.session?.id);
  // Without a session id the cap can't be enforced, so the answer is withheld and the call never connects.
  if (!answer.startsWith('v=0') || !sessionId) return jsonError(502, 'VOICE_UNAVAILABLE', 'Voice couldn’t start just now. Type instead.');

  const seconds = voiceCallLimitSeconds();
  after(async () => {
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    await fetch(`${LIVE_URL}/${encodeURIComponent(sessionId)}/hangup`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    }).catch(() => undefined);
  });
  return jsonOk({ sdp: answer, seconds, intent });
}

/** Session ids are opaque ("live_123"); only a safe shape is used in the hang-up URL. */
export function sessionIdFrom(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{4,120}$/.test(value) ? value : null;
}
