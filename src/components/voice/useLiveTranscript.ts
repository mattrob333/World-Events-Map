'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { results: ArrayLike<RecognitionResult> };
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noopSubscribe = () => () => {};

export type TranscriptStatus = 'idle' | 'listening' | 'denied' | 'error';

/**
 * Live speech-to-text for the Vibe stage, using the browser's own speech
 * service (Chrome sends audio to Google; dope.travel only sees the text).
 *
 * Each recognition session's text is rebuilt from its full result list on
 * every event, so repeated or cumulative results can't double words. Android
 * Chrome runs short sessions (continuous mode repeats phrases there) that
 * restart until the traveler stops.
 *
 * Stopping shows the session's words (interim included) as final right away,
 * then lets the browser's last result replace them rather than append: Chrome
 * sends one more full result after stop(), other browsers don't.
 */
export function useLiveTranscript() {
  const supported = useSyncExternalStore(noopSubscribe, () => recognitionCtor() !== null, () => true);
  const [status, setStatus] = useState<TranscriptStatus>('idle');
  const [base, setBase] = useState('');
  const [finals, setFinals] = useState('');
  const [pending, setPending] = useState('');
  const [closing, setClosing] = useState(false);
  const baseRef = useRef('');
  const finalsRef = useRef('');
  const pendingRef = useRef('');
  const recognition = useRef<Recognition | null>(null);
  const generation = useRef(0);
  const wanted = useRef(false);
  const lastWordAt = useRef(0);

  /** Fold the current session (finals, then any unfinished words) into the text. */
  const finalize = useCallback(() => {
    const chunk = [finalsRef.current, pendingRef.current].filter(Boolean).join(' ').trim();
    finalsRef.current = '';
    pendingRef.current = '';
    setFinals('');
    setPending('');
    setClosing(false);
    if (!chunk || baseRef.current.endsWith(chunk)) return;
    baseRef.current = [baseRef.current, chunk].filter(Boolean).join(' ');
    setBase(baseRef.current);
  }, []);

  useEffect(() => () => {
    wanted.current = false;
    recognition.current?.abort();
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    // Words from a stopped session that never reported its end are kept first.
    finalize();
    const android = /Android/i.test(navigator.userAgent);
    const rec = new Ctor();
    const gen = ++generation.current;
    // Events from an aborted or replaced recognizer, or from before the text was edited, are ignored.
    const current = () => recognition.current === rec && generation.current === gen;
    rec.continuous = !android;
    rec.interimResults = true;
    rec.lang = navigator.language || 'en-US';
    rec.onresult = (event) => {
      if (!current()) return;
      let heard = '';
      let unfinished = '';
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) heard += `${result[0].transcript} `;
        else unfinished += result[0].transcript;
      }
      finalsRef.current = heard.trim();
      pendingRef.current = unfinished.trim();
      setFinals(finalsRef.current);
      setPending(pendingRef.current);
      lastWordAt.current = performance.now();
    };
    rec.onerror = (event) => {
      if (!current() || event.error === 'no-speech' || event.error === 'aborted') return;
      wanted.current = false;
      setStatus(event.error === 'not-allowed' || event.error === 'service-not-allowed' ? 'denied' : 'error');
    };
    rec.onend = () => {
      if (!current()) return;
      finalize();
      if (wanted.current) {
        try {
          rec.start();
          return;
        } catch {
          wanted.current = false;
        }
      }
      setStatus((value) => (value === 'listening' ? 'idle' : value));
    };
    recognition.current?.abort();
    recognition.current = rec;
    wanted.current = true;
    try {
      rec.start();
      setStatus('listening');
    } catch {
      setStatus('error');
    }
  }, [finalize]);

  const stop = useCallback(() => {
    wanted.current = false;
    setClosing(true);
    recognition.current?.stop();
    setStatus((value) => (value === 'listening' ? 'idle' : value));
  }, []);

  /** Replace the transcript (the traveler fixed a word, or typed instead). */
  const setText = useCallback((text: string) => {
    generation.current += 1;
    baseRef.current = text;
    finalsRef.current = '';
    pendingRef.current = '';
    setBase(text);
    setFinals('');
    setPending('');
    setClosing(false);
  }, []);

  /** 0..1, high right after words arrive, for the sun to swell with. */
  const activity = useCallback(() => {
    const since = performance.now() - lastWordAt.current;
    return Math.max(0, 1 - since / 700);
  }, []);

  const text = [base, finals, closing ? pending : ''].filter(Boolean).join(' ');
  const interim = closing ? '' : pending;
  return { supported, status, text, interim, start, stop, setText, activity };
}
