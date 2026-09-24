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
 */
export function useLiveTranscript() {
  const supported = useSyncExternalStore(noopSubscribe, () => recognitionCtor() !== null, () => true);
  const [status, setStatus] = useState<TranscriptStatus>('idle');
  const [committed, setCommitted] = useState('');
  const [session, setSession] = useState('');
  const [interim, setInterim] = useState('');
  const committedRef = useRef('');
  const sessionRef = useRef('');
  const recognition = useRef<Recognition | null>(null);
  const wanted = useRef(false);
  const lastWordAt = useRef(0);

  const commitSession = useCallback(() => {
    const chunk = sessionRef.current.trim();
    sessionRef.current = '';
    setSession('');
    setInterim('');
    if (!chunk || committedRef.current.endsWith(chunk)) return;
    committedRef.current = [committedRef.current, chunk].filter(Boolean).join(' ');
    setCommitted(committedRef.current);
  }, []);

  useEffect(() => () => {
    wanted.current = false;
    recognition.current?.abort();
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const android = /Android/i.test(navigator.userAgent);
    const rec = new Ctor();
    rec.continuous = !android;
    rec.interimResults = true;
    rec.lang = navigator.language || 'en-US';
    rec.onresult = (event) => {
      let finals = '';
      let pending = '';
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finals += `${result[0].transcript} `;
        else pending += result[0].transcript;
      }
      sessionRef.current = finals.trim();
      setSession(sessionRef.current);
      setInterim(pending.trim());
      lastWordAt.current = performance.now();
    };
    rec.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      wanted.current = false;
      setStatus(event.error === 'not-allowed' || event.error === 'service-not-allowed' ? 'denied' : 'error');
    };
    rec.onend = () => {
      commitSession();
      if (wanted.current) {
        try {
          rec.start();
          return;
        } catch {
          wanted.current = false;
        }
      }
      setStatus((current) => (current === 'listening' ? 'idle' : current));
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
  }, [commitSession]);

  const stop = useCallback(() => {
    wanted.current = false;
    recognition.current?.stop();
    commitSession();
    setStatus((current) => (current === 'listening' ? 'idle' : current));
  }, [commitSession]);

  /** Replace the transcript (the traveler fixed a word, or typed instead). */
  const setText = useCallback((text: string) => {
    committedRef.current = text;
    sessionRef.current = '';
    setCommitted(text);
    setSession('');
    setInterim('');
  }, []);

  /** 0..1, high right after words arrive, for the sun to swell with. */
  const activity = useCallback(() => {
    const since = performance.now() - lastWordAt.current;
    return Math.max(0, 1 - since / 700);
  }, []);

  const text = [committed, session].filter(Boolean).join(' ');
  return { supported, status, text, interim, start, stop, setText, activity };
}
