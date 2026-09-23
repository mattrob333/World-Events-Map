'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
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

export type DictationStatus = 'unsupported' | 'idle' | 'listening' | 'denied' | 'error';

/**
 * Browser speech-to-text. The browser's own speech service does the
 * recognition (Chrome sends audio to Google); MERIDIAN only receives the text.
 */
export function useDictation(onFinal: (text: string) => void) {
  const supported = useSyncExternalStore(noopSubscribe, () => recognitionCtor() !== null, () => true);
  const [state, setStatus] = useState<Exclude<DictationStatus, 'unsupported'>>('idle');
  const status: DictationStatus = supported ? state : 'unsupported';
  const [interim, setInterim] = useState('');
  const recognition = useRef<Recognition | null>(null);
  const wanted = useRef(false);
  const finalRef = useRef(onFinal);
  useEffect(() => {
    finalRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => {
    return () => {
      wanted.current = false;
      recognition.current?.stop();
    };
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || 'en-US';
    rec.onresult = (event) => {
      let pending = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalRef.current(result[0].transcript.trim());
        else pending += result[0].transcript;
      }
      setInterim(pending);
    };
    rec.onerror = (event) => {
      wanted.current = false;
      setStatus(event.error === 'not-allowed' || event.error === 'service-not-allowed' ? 'denied' : 'error');
    };
    rec.onend = () => {
      setInterim('');
      // Chrome ends sessions after silence; keep listening until the user stops.
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
    recognition.current = rec;
    wanted.current = true;
    try {
      rec.start();
      setStatus('listening');
    } catch {
      setStatus('error');
    }
  }, []);

  const stop = useCallback(() => {
    wanted.current = false;
    recognition.current?.stop();
    setStatus('idle');
  }, []);

  return { status, interim, start, stop };
}
