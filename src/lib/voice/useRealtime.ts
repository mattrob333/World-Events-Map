'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { VoiceHandlers } from './registry';
import type { VoiceIntent } from './tools';

export type VoicePhase = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error' | 'ended';
export type VoiceLine = { who: 'you' | 'sun' | 'done'; text: string };
/** What the backend is doing right now, for the canvas's status line. */
export type VoiceActivity = { kind: 'delegated' | 'searching' | 'tool' | 'idle'; label?: string };

type StartOptions = {
  intent: VoiceIntent;
  context: string;
  /** A short summary of the traveler's saved profile, for the backend's ranking. */
  profile?: string;
  handlers: VoiceHandlers;
  withMic: boolean;
  /** The exact first line the concierge says. */
  opener?: string;
  onActivity?: (activity: VoiceActivity) => void;
};

type FunctionCall = { name: string; call_id: string; arguments: string };
// Calls in one response run in order (show the places, then mark the best fits), each as soon as it arrives.
type Pending = { outputs: Promise<{ call: FunctionCall; output: string }>[]; chain: Promise<unknown> };

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** RMS level 0..1 from an analyser, read each animation frame by the orb. */
function levelOf(analyser: AnalyserNode | null, buffer: Uint8Array<ArrayBuffer> | null): number {
  if (!analyser || !buffer) return 0;
  analyser.getByteTimeDomainData(buffer);
  let sum = 0;
  for (const v of buffer) {
    const x = (v - 128) / 128;
    sum += x * x;
  }
  return Math.min(1, Math.sqrt(sum / buffer.length) * 3.2);
}

/**
 * One GPT-Live conversation over WebRTC. Our session route opens it
 * server-side (the browser never holds a key) and hangs it up at a time cap.
 * GPT-Live talks and listens at once; when it delegates, OpenAI runs the
 * Responses backend, whose function calls arrive here wrapped in
 * `response.event`, run against the page's handlers as soon as they arrive
 * (so the canvas fills while the backend works), and go back as
 * `response.item.create` plus `response.create` once that response completes.
 */
export function useRealtime() {
  const [phase, setPhase] = useState<VoicePhase>('idle');
  const [lines, setLines] = useState<VoiceLine[]>([]);
  const [error, setError] = useState('');
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const micAnalyser = useRef<{ node: AnalyserNode; buf: Uint8Array<ArrayBuffer> } | null>(null);
  const sunAnalyser = useRef<{ node: AnalyserNode; buf: Uint8Array<ArrayBuffer> } | null>(null);
  const handlersRef = useRef<VoiceHandlers>({});
  const activityRef = useRef<StartOptions['onActivity']>(undefined);
  const timerRef = useRef<number | null>(null);
  const speakPoll = useRef<number | null>(null);
  const openerRef = useRef<string | undefined>(undefined);
  const pending = useRef(new Map<string, Pending>());
  const eventSeq = useRef(0);

  /** Transcript deltas grow the speaker's current line; a new speaker starts a new one. */
  const grow = useCallback((who: 'you' | 'sun', delta: string) => {
    setLines((prev) => {
      const last = prev[prev.length - 1];
      if (last?.who === who) return [...prev.slice(0, -1), { who, text: last.text + delta }];
      return [...prev.slice(-19), { who, text: delta.trimStart() }];
    });
  }, []);

  const teardown = useCallback((final: VoicePhase) => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (speakPoll.current) window.clearInterval(speakPoll.current);
    dcRef.current?.close();
    pcRef.current?.getSenders().forEach((sender) => sender.track?.stop());
    pcRef.current?.close();
    micRef.current?.getTracks().forEach((track) => track.stop());
    if (audioRef.current) audioRef.current.srcObject = null;
    void ctxRef.current?.close().catch(() => undefined);
    pcRef.current = null;
    dcRef.current = null;
    micRef.current = null;
    ctxRef.current = null;
    micAnalyser.current = null;
    sunAnalyser.current = null;
    pending.current.clear();
    activityRef.current?.({ kind: 'idle' });
    setPhase(final);
  }, []);

  const send = useCallback((event: Record<string, unknown>) => {
    const dc = dcRef.current;
    if (dc?.readyState !== 'open') return;
    eventSeq.current += 1;
    dc.send(JSON.stringify({ event_id: `evt_${eventSeq.current}`, ...event }));
  }, []);

  /** Ends the conversation: ask for a graceful close, then release everything shortly after. */
  const stop = useCallback((final: VoicePhase = 'ended') => {
    if (dcRef.current?.readyState === 'open') {
      send({ type: 'session.close' });
      setPhase(final);
      window.setTimeout(() => teardown(final), 1500);
      return;
    }
    teardown(final);
  }, [send, teardown]);

  useEffect(() => () => teardown('ended'), [teardown]);

  const runCall = useCallback(async (call: FunctionCall): Promise<{ call: FunctionCall; output: string }> => {
    let output: string;
    try {
      const handler = handlersRef.current[call.name as keyof VoiceHandlers];
      const args = call.arguments ? (JSON.parse(call.arguments) as Record<string, unknown>) : {};
      activityRef.current?.({ kind: 'tool', label: call.name });
      output = handler ? await handler(args) : 'That isn’t available here.';
    } catch (cause) {
      output = `Error: ${cause instanceof Error ? cause.message : 'that didn’t work'}`;
    }
    return { call, output };
  }, []);

  /** A backend response finished: return every function result, then let it continue (unless one ended the talk). */
  const settle = useCallback(async (responseId: string) => {
    const entry = pending.current.get(responseId);
    pending.current.delete(responseId);
    activityRef.current?.({ kind: 'idle' });
    if (!entry?.outputs.length) return;
    const results = await Promise.all(entry.outputs);
    let ending = false;
    for (const { call, output } of results) {
      let text = output;
      if (text.startsWith('END:')) {
        ending = true;
        text = text.slice(4).trim();
      }
      send({ type: 'response.item.create', item: { type: 'function_call_output', call_id: call.call_id, output: text } });
    }
    if (!ending) send({ type: 'response.create' });
  }, [send]);

  const onBackendEvent = useCallback((inner: { type?: string; [key: string]: unknown }) => {
    const responseId = (inner.response as { id?: string } | undefined)?.id ?? (typeof inner.response_id === 'string' ? inner.response_id : '');
    const current = () => responseId || [...pending.current.keys()].pop() || 'current';
    switch (inner.type) {
      case 'response.created':
        pending.current.set(current(), { outputs: [], chain: Promise.resolve() });
        break;
      case 'response.output_item.added': {
        const item = inner.item as { type?: string } | undefined;
        if (item?.type === 'web_search_call') activityRef.current?.({ kind: 'searching' });
        break;
      }
      case 'response.output_item.done': {
        const item = inner.item as { type?: string; name?: string; call_id?: string; arguments?: string } | undefined;
        if (item?.type !== 'function_call' || !item.name || !item.call_id) break;
        const key = current();
        const entry = pending.current.get(key) ?? { outputs: [], chain: Promise.resolve() };
        const call = { name: item.name, call_id: item.call_id, arguments: item.arguments ?? '' };
        const result = entry.chain.then(() => runCall(call));
        entry.chain = result;
        entry.outputs.push(result);
        pending.current.set(key, entry);
        break;
      }
      case 'response.completed':
      case 'response.incomplete':
      case 'response.failed':
        void settle(current());
        break;
    }
  }, [runCall, settle]);

  const onEvent = useCallback((raw: string) => {
    let event: { type?: string; [key: string]: unknown };
    try {
      event = JSON.parse(raw);
    } catch {
      return;
    }
    switch (event.type) {
      case 'session.started':
        setPhase('listening');
        if (openerRef.current) {
          send({ type: 'session.instructions.append', delegation_id: null, content: `Greet them now. Say exactly this, then stop and listen: "${openerRef.current.replace(/"/g, '')}"` });
        }
        break;
      case 'session.input_transcript.delta':
        if (typeof event.delta === 'string') grow('you', event.delta);
        break;
      case 'session.output_transcript.delta':
        if (typeof event.delta === 'string') grow('sun', event.delta);
        break;
      case 'session.delegation.created':
        activityRef.current?.({ kind: 'delegated' });
        break;
      case 'response.event':
        if (event.event && typeof event.event === 'object') onBackendEvent(event.event as { type?: string });
        break;
      case 'session.closed':
        teardown('ended');
        break;
      case 'error': {
        const message = (event.error as { message?: string } | undefined)?.message;
        if (message) setError(message);
        break;
      }
    }
  }, [grow, onBackendEvent, send, teardown]);

  const start = useCallback(async ({ intent, context, profile = '', handlers, withMic, opener, onActivity }: StartOptions): Promise<'ok' | 'not-configured' | 'failed' | 'mic-denied'> => {
    teardown('idle');
    handlersRef.current = handlers;
    activityRef.current = onActivity;
    openerRef.current = opener;
    setLines([]);
    setError('');
    setPhase('connecting');
    let mic: MediaStream | null = null;
    if (withMic) {
      try {
        mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      } catch {
        setPhase('idle');
        return 'mic-denied';
      }
    }
    try {
      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const audio = new Audio();
      audio.autoplay = true;
      audioRef.current = audio;
      pc.ontrack = (e) => {
        const stream = e.streams[0] ?? new MediaStream([e.track]);
        audio.srcObject = stream;
        void audio.play().catch(() => undefined);
        const node = ctx.createAnalyser();
        node.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(node);
        sunAnalyser.current = { node, buf: new Uint8Array(new ArrayBuffer(node.fftSize)) };
      };
      if (mic) {
        micRef.current = mic;
        for (const track of mic.getAudioTracks()) pc.addTrack(track, mic);
        const node = ctx.createAnalyser();
        node.fftSize = 512;
        ctx.createMediaStreamSource(mic).connect(node);
        micAnalyser.current = { node, buf: new Uint8Array(new ArrayBuffer(node.fftSize)) };
      } else {
        pc.addTransceiver('audio', { direction: 'recvonly' });
      }
      // The event channel exists before the offer, so the session's first events aren't missed.
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;
      dc.onmessage = (e) => onEvent(String(e.data));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (pc.iceGatheringState !== 'complete') {
        await new Promise<void>((resolve) => {
          const done = () => {
            if (pc.iceGatheringState !== 'complete') return;
            pc.removeEventListener('icegatheringstatechange', done);
            resolve();
          };
          pc.addEventListener('icegatheringstatechange', done);
          window.setTimeout(resolve, 3000);
        });
      }
      const session = await fetch('/api/voice/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent, context, profile, today: localToday(), sdp: pc.localDescription?.sdp ?? offer.sdp }),
      }).catch(() => null);
      const body = (await session?.json().catch(() => null)) as { sdp?: string; seconds?: number; error?: string; code?: string } | null;
      if (!session?.ok || !body?.sdp) {
        teardown('error');
        setError(body?.error ?? 'Voice couldn’t start just now.');
        return body?.code === 'VOICE_NOT_CONFIGURED' ? 'not-configured' : 'failed';
      }
      await pc.setRemoteDescription({ type: 'answer', sdp: body.sdp });
      const seconds = typeof body.seconds === 'number' ? body.seconds : 240;
      timerRef.current = window.setTimeout(() => teardown('ended'), seconds * 1000);
      // GPT-Live has no "done speaking" event over WebRTC; the output level says when it talks.
      let quietSince = 0;
      speakPoll.current = window.setInterval(() => {
        const level = levelOf(sunAnalyser.current?.node ?? null, sunAnalyser.current?.buf ?? null);
        setPhase((now) => {
          if (now !== 'listening' && now !== 'speaking') return now;
          if (level > 0.04) {
            quietSince = 0;
            return 'speaking';
          }
          if (now === 'speaking') {
            quietSince ||= Date.now();
            return Date.now() - quietSince > 500 ? 'listening' : 'speaking';
          }
          return now;
        });
      }, 120);
      return 'ok';
    } catch (cause) {
      teardown('error');
      setError(cause instanceof Error ? cause.message : 'Voice couldn’t connect.');
      return 'failed';
    }
  }, [onEvent, teardown]);

  /** Pause keeps the session and stops sending the mic; resume turns it back on. */
  const setMicMuted = useCallback((muted: boolean) => {
    send({ type: muted ? 'session.input_audio.mute' : 'session.input_audio.unmute' });
    setPhase(muted ? 'thinking' : 'listening');
  }, [send]);

  /** Mute voice: the concierge keeps going as captions; only playback is silenced. */
  const setTextOnly = useCallback((textOnly: boolean) => {
    if (audioRef.current) audioRef.current.muted = textOnly;
  }, []);

  const levels = useCallback(() => ({
    mic: levelOf(micAnalyser.current?.node ?? null, micAnalyser.current?.buf ?? null),
    sun: levelOf(sunAnalyser.current?.node ?? null, sunAnalyser.current?.buf ?? null),
  }), []);

  const live = phase === 'listening' || phase === 'thinking' || phase === 'speaking';
  return { phase, lines, error, start, stop, setTextOnly, setMicMuted, levels, live, connected: () => dcRef.current?.readyState === 'open' };
}
