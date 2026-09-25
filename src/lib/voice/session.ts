import { INTENT_TOOLS, VOICE_TOOLS, voiceInstructions, type VoiceIntent } from './tools';

/** Verified 2026-09-24 on this account. */
export const VOICE_MODEL = process.env.VOICE_REALTIME_MODEL || 'gpt-realtime-2.1';

/** The Realtime API's built-in voices (fable, nova and onyx are text-to-speech only). */
export const REALTIME_VOICES = ['marin', 'cedar', 'alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse'] as const;

/** VOICE_NAME picks the voice without a code change; anything unknown falls back to marin. */
export function voiceName(): string {
  const wanted = process.env.VOICE_NAME?.trim().toLowerCase() ?? '';
  return (REALTIME_VOICES as readonly string[]).includes(wanted) ? wanted : 'marin';
}

/** Hard cap on one call; the route hangs up server-side at this point. */
export function voiceCallLimitSeconds(): number {
  const raw = Number(process.env.VOICE_MAX_SECONDS);
  return Number.isFinite(raw) && raw > 0 ? Math.min(280, Math.max(30, Math.round(raw))) : 240;
}

export function cleanContext(value: string): string {
  return value.replace(/[\u0000-\u001f<>]/g, ' ').slice(0, 600);
}

/** The session the server opens: tools from the page intent's allowlist only. */
export function voiceSessionConfig(intent: VoiceIntent, context: string, today: string) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(today) ? today : new Date().toISOString().slice(0, 10);
  return {
    type: 'realtime',
    model: VOICE_MODEL,
    instructions: voiceInstructions(intent, cleanContext(context), day),
    tools: INTENT_TOOLS[intent].map((name) => ({ type: 'function', ...VOICE_TOOLS[name] })),
    tool_choice: 'auto',
    max_output_tokens: 1200,
    audio: {
      input: { transcription: { model: 'gpt-4o-mini-transcribe' }, turn_detection: { type: 'semantic_vad' } },
      output: { voice: voiceName() },
    },
  };
}

/** "/v1/realtime/calls/rtc_abc" → "rtc_abc". */
export function callIdFrom(location: string | null): string | null {
  const id = location?.split('?')[0].split('/').filter(Boolean).pop() ?? '';
  return /^[A-Za-z0-9_-]{4,120}$/.test(id) ? id : null;
}
