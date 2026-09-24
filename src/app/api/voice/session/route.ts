import { take } from '@/lib/designer/server/dailyBudget';
import { RequestTooLargeError, checkBoundary, consumeProviderCall, jsonError, jsonOk, readJson } from '@/lib/designer/server/guard';
import { INTENT_TOOLS, VOICE_TOOLS, isVoiceIntent, voiceInstructions } from '@/lib/voice/tools';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Verified 2026-09-24 against /v1/realtime/client_secrets on this account. */
const MODEL = process.env.VOICE_REALTIME_MODEL || 'gpt-realtime-2.1';
const KEY_SECONDS = 300;

/**
 * Mints a short-lived OpenAI Realtime key for the Sun (the voice modal).
 * The browser then talks to OpenAI directly over WebRTC and runs the tools
 * locally; this route never sees audio. The page's intent picks the tools
 * from a fixed allowlist, and the context line is plain text capped short.
 */
export async function POST(request: Request) {
  const boundary = checkBoundary(request);
  if (boundary) return boundary;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return jsonError(503, 'VOICE_NOT_CONFIGURED', 'Voice isn’t set up on this site yet. Type instead.');
  let body: Record<string, unknown>;
  try {
    body = ((await readJson(request, 4000)) ?? {}) as Record<string, unknown>;
  } catch (cause) {
    if (cause instanceof RequestTooLargeError) return jsonError(413, 'TOO_LARGE', 'That request is too large.');
    return jsonError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }
  const intent = isVoiceIntent(body.intent) ? body.intent : 'general';
  const context = typeof body.context === 'string' ? body.context.replace(/[\u0000-\u001f<>]/g, ' ').slice(0, 600) : '';
  const today = typeof body.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : new Date().toISOString().slice(0, 10);

  if (!consumeProviderCall(request, 'voice')) return jsonError(429, 'VOICE_COOLDOWN', 'Lots of talking just now. Give it a few minutes, or type instead.');
  if (!take('voice')) return jsonError(503, 'VOICE_DAILY_LIMIT', 'Voice is resting for today. Type instead; it works the same.');

  const tools = INTENT_TOOLS[intent].map((name) => ({ type: 'function', ...VOICE_TOOLS[name] }));
  const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      expires_after: { anchor: 'created_at', seconds: KEY_SECONDS },
      session: {
        type: 'realtime',
        model: MODEL,
        instructions: voiceInstructions(intent, context, today),
        tools,
        tool_choice: 'auto',
        max_output_tokens: 1200,
        audio: {
          input: { transcription: { model: 'gpt-4o-mini-transcribe' }, turn_detection: { type: 'semantic_vad' } },
          output: { voice: 'marin' },
        },
      },
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!response?.ok) return jsonError(502, 'VOICE_UNAVAILABLE', 'Voice couldn’t start just now. Type instead.');
  const payload = (await response.json().catch(() => null)) as { value?: unknown; expires_at?: unknown } | null;
  if (typeof payload?.value !== 'string' || !payload.value.startsWith('ek_')) return jsonError(502, 'VOICE_UNAVAILABLE', 'Voice couldn’t start just now. Type instead.');
  return jsonOk({ key: payload.value, expiresAt: payload.expires_at, model: MODEL, intent });
}
