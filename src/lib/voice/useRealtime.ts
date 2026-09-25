'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { VoiceHandlers } from './registry';
import type { VoiceIntent } from './tools';

export type VoicePhase = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error' | 'ended';
export type VoiceLine = { who: 'you' | 'sun' | 'done'; text: string };

type StartOptions = {
  intent: VoiceIntent;
  context: string;
  handlers: VoiceHandlers;
  withMic: boolean;
  textOnly?: boolean;
  /** The exact first line the concierge says, instead of an opener of its own. */
  opener?: string;
};

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
 * One OpenAI Realtime conversation over WebRTC. Our session route opens the
 * call server-side (the browser never holds a key) and ends it at a time
 * cap; audio then flows browser ↔ OpenAI directly. Function calls arrive on
 * the data channel, run against the page's handlers, and their results go
 * back to the model.
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
  const draftRef = useRef('');
  const timerRef = useRef<number | null>(null);

  const push = useCallback((line: VoiceLine) => setLines((prev) => [...prev.slice(-11), line]), []);

  const stop = useCallback((final: VoicePhase = 'ended') => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
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
    setPhase(final);
  }, []);

  useEffect(() => () => stop(), [stop]);

  const send = useCallback((event: unknown) => {
    const dc = dcRef.current;
    if (dc?.readyState === 'open') dc.send(JSON.stringify(event));
  }, []);

  const runCalls = useCallback(async (calls: { name: string; call_id: string; arguments: string }[]) => {
    // A handler that answers "END: …" finishes the conversation: no reply is asked for after it.
    let ending = false;
    for (const call of calls) {
      let output: string;
      try {
        const handler = handlersRef.current[call.name as keyof VoiceHandlers];
        const args = call.arguments ? (JSON.parse(call.arguments) as Record<string, unknown>) : {};
        output = handler ? await handler(args) : 'That isn’t available on this page.';
      } catch (cause) {
        output = `Error: ${cause instanceof Error ? cause.message : 'that didn’t work'}`;
      }
      if (output.startsWith('END:')) {
        ending = true;
        output = output.slice(4).trim();
      }
      // Locking a fact lights its bullet; it isn't worth a line in the transcript.
      if (call.name !== 'lock_fact') push({ who: 'done', text: output });
      send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: call.call_id, output } });
    }
    if (!ending) send({ type: 'response.create' });
  }, [push, send]);

  const onEvent = useCallback((raw: string) => {
    let event: { type?: string; [key: string]: unknown };
    try {
      event = JSON.parse(raw);
    } catch {
      return;
    }
    switch (event.type) {
      case 'input_audio_buffer.speech_started':
        setPhase('listening');
        break;
      case 'input_audio_buffer.speech_stopped':
        setPhase('thinking');
        break;
      case 'conversation.item.input_audio_transcription.completed':
        if (typeof event.transcript === 'string' && event.transcript.trim()) push({ who: 'you', text: event.transcript.trim() });
        break;
      case 'output_audio_buffer.started':
        setPhase('speaking');
        break;
      case 'output_audio_buffer.stopped':
        setPhase('listening');
        break;
      case 'response.output_audio_transcript.delta':
      case 'response.audio_transcript.delta':
        if (typeof event.delta === 'string') draftRef.current += event.delta;
        break;
      case 'response.output_text.delta':
        if (typeof event.delta === 'string') draftRef.current += event.delta;
        break;
      case 'response.output_text.done':
      case 'response.output_audio_transcript.done':
      case 'response.audio_transcript.done': {
        const said = typeof event.transcript === 'string' ? event.transcript : typeof event.text === 'string' ? event.text : draftRef.current;
        const text = said.trim();
        draftRef.current = '';
        if (text) push({ who: 'sun', text });
        break;
      }
      case 'response.done': {
        const response = event.response as { output?: { type?: string; name?: string; call_id?: string; arguments?: string }[] } | undefined;
        const calls = (response?.output ?? []).filter((item) => item.type === 'function_call' && item.name && item.call_id) as { name: string; call_id: string; arguments: string }[];
        if (calls.length) void runCalls(calls);
        break;
      }
      case 'error': {
        const message = (event.error as { message?: string } | undefined)?.message;
        if (message) setError(message);
        break;
      }
    }
  }, [push, runCalls]);

  const start = useCallback(async ({ intent, context, handlers, withMic, textOnly = false, opener }: StartOptions): Promise<'ok' | 'not-configured' | 'failed' | 'mic-denied'> => {
    stop('idle');
    handlersRef.current = handlers;
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
        audio.srcObject = e.streams[0];
        const node = ctx.createAnalyser();
        node.fftSize = 512;
        ctx.createMediaStreamSource(e.streams[0]).connect(node);
        sunAnalyser.current = { node, buf: new Uint8Array(new ArrayBuffer(node.fftSize)) };
      };
      if (mic) {
        micRef.current = mic;
        pc.addTrack(mic.getTracks()[0], mic);
        const node = ctx.createAnalyser();
        node.fftSize = 512;
        ctx.createMediaStreamSource(mic).connect(node);
        micAnalyser.current = { node, buf: new Uint8Array(new ArrayBuffer(node.fftSize)) };
      } else {
        pc.addTransceiver('audio', { direction: 'recvonly' });
      }
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;
      dc.onmessage = (e) => onEvent(String(e.data));
      dc.onopen = () => {
        setPhase(mic ? 'listening' : 'thinking');
        if (textOnly) send({ type: 'session.update', session: { type: 'realtime', output_modalities: ['text'] } });
        send(opener
          ? { type: 'response.create', response: { instructions: `Say exactly this, then stop and listen: "${opener.replace(/"/g, '')}"` } }
          : { type: 'response.create' });
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      // Our server opens the call with OpenAI and hangs it up at the time cap.
      const session = await fetch('/api/voice/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent, context, today: localToday(), sdp: offer.sdp }),
      }).catch(() => null);
      const body = (await session?.json().catch(() => null)) as { sdp?: string; seconds?: number; error?: string; code?: string } | null;
      if (!session?.ok || !body?.sdp) {
        stop('error');
        setError(body?.error ?? 'Voice couldn’t start just now.');
        return body?.code === 'VOICE_NOT_CONFIGURED' ? 'not-configured' : 'failed';
      }
      await pc.setRemoteDescription({ type: 'answer', sdp: body.sdp });
      const seconds = typeof body.seconds === 'number' ? body.seconds : 240;
      timerRef.current = window.setTimeout(() => stop('ended'), seconds * 1000);
      return 'ok';
    } catch (cause) {
      stop('error');
      setError(cause instanceof Error ? cause.message : 'Voice couldn’t connect.');
      return 'failed';
    }
  }, [onEvent, send, stop]);

  const say = useCallback((text: string) => {
    const clean = text.trim().slice(0, 1000);
    if (!clean) return;
    push({ who: 'you', text: clean });
    send({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: clean }] } });
    send({ type: 'response.create' });
    setPhase('thinking');
  }, [push, send]);

  /** Caveman mode: the concierge answers in text instead of speaking. */
  const setTextOnly = useCallback((textOnly: boolean) => {
    send({ type: 'session.update', session: { type: 'realtime', output_modalities: [textOnly ? 'text' : 'audio'] } });
  }, [send]);

  const levels = useCallback(() => ({
    mic: levelOf(micAnalyser.current?.node ?? null, micAnalyser.current?.buf ?? null),
    sun: levelOf(sunAnalyser.current?.node ?? null, sunAnalyser.current?.buf ?? null),
  }), []);

  const live = phase === 'listening' || phase === 'thinking' || phase === 'speaking';
  return { phase, lines, error, start, stop, say, setTextOnly, levels, live, connected: () => dcRef.current?.readyState === 'open' };
}
