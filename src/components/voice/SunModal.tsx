'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { pickActiveProfile, profileLabel, useDesignerStore } from '@/lib/designer/store';
import { useVoiceStore, type VoiceHandlers } from '@/lib/voice/registry';
import { routeFor } from '@/lib/voice/tools';
import { useRealtime, type VoicePhase } from '@/lib/voice/useRealtime';
import { SunOrb } from './SunOrb';

const STATUS: Record<VoicePhase, string> = {
  idle: 'Tap the sun to talk',
  connecting: 'Waking up…',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Talking',
  error: 'Voice isn’t available',
  ended: 'Tap the sun to talk again',
};

/**
 * The voice concierge. Opens over any page, talks through what the page
 * registered (useVoicePage), and falls back to typing: over the same live
 * session when there is one, or to the page's on-device parser when voice
 * isn't set up.
 */
export function SunModal() {
  const open = useVoiceStore((s) => s.open);
  return open ? <SunSession /> : null;
}

function SunSession() {
  const setOpen = useVoiceStore((s) => s.setOpen);
  const page = useVoiceStore((s) => s.page);
  const router = useRouter();
  const rt = useRealtime();
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const [notes, setNotes] = useState<string[]>([]);
  const [voiceOff, setVoiceOff] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handlers = useCallback((): VoiceHandlers => {
    const navigate: VoiceHandlers['navigate'] = (args) => {
      const href = routeFor(args.to);
      if (!href) return 'I can’t open that.';
      router.push(href);
      return `Opened ${String(args.to)}.`;
    };
    const switchProfile: VoiceHandlers['switch_profile'] = (args) => {
      const wanted = typeof args.name === 'string' ? args.name.trim().toLowerCase() : '';
      const { profiles, setActiveProfile } = useDesignerStore.getState();
      const match =
        profiles.find((entry) => profileLabel(entry).toLowerCase() === wanted) ??
        profiles.find((entry) => wanted && (entry.profile.name ?? '').toLowerCase().includes(wanted)) ??
        profiles.find((entry) => wanted && profileLabel(entry).toLowerCase().includes(wanted));
      if (!match) return profiles.length ? `Error: no profile called ${String(args.name)}. They have: ${profiles.map(profileLabel).join(', ')}.` : 'Error: no profiles yet. Offer to make one on the mood board.';
      setActiveProfile(match.id);
      return `Now traveling as ${profileLabel(match)}.`;
    };
    return { navigate, switch_profile: switchProfile, ...(page?.handlers ?? {}) };
  }, [page, router]);

  const context = useCallback(() => {
    const { profiles, activeProfileId } = useDesignerStore.getState();
    const active = pickActiveProfile(profiles, activeProfileId);
    const who = active
      ? `Traveling as ${profileLabel(active)}${active.profile.name ? ` (${active.profile.name})` : ''}. Profiles on this device: ${profiles.map(profileLabel).join(', ')}.`
      : 'No travel profile yet.';
    return [who, page?.context() ?? ''].filter(Boolean).join(' ');
  }, [page]);

  const begin = useCallback(async (withMic: boolean) => {
    setNotes([]);
    const result = await rt.start({
      intent: page?.intent ?? 'general',
      context: context(),
      handlers: handlers(),
      withMic,
      textOnly: !withMic,
    });
    if (result === 'mic-denied') {
      setTyping(true);
      setNotes(['No microphone, so we’ll type. Allow the mic in your browser to talk instead.']);
      void rt.start({ intent: page?.intent ?? 'general', context: context(), handlers: handlers(), withMic: false, textOnly: true });
    } else if (result === 'not-configured') {
      setVoiceOff(true);
      setTyping(true);
    }
  }, [context, handlers, page, rt]);

  // Start listening as soon as the modal opens (the tap that opened it is the gesture).
  const beginRef = useRef(begin);
  const stopRef = useRef(rt.stop);
  useEffect(() => {
    void beginRef.current(true);
    const stop = stopRef.current;
    return () => stop('idle');
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    dialogRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  useEffect(() => {
    if (typing) inputRef.current?.focus();
  }, [typing]);

  const switchToTyping = () => {
    setTyping(true);
    if (rt.connected()) rt.setTextOnly(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    if (rt.connected()) {
      rt.say(text);
      return;
    }
    if (page?.fallback) {
      const reply = await page.fallback(text);
      setNotes((prev) => [...prev.slice(-5), `You: ${text}`, reply]);
      return;
    }
    setNotes((prev) => [...prev.slice(-5), 'Voice isn’t set up here yet, and this page has nothing to type into. Use the page as usual.']);
  };

  const orbTap = () => {
    if (rt.live || rt.phase === 'connecting') return;
    setTyping(false);
    void begin(true);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center" onClick={() => setOpen(false)}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Talk to dope.travel"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="surface relative flex w-full max-w-[420px] flex-col items-center gap-4 rounded-[var(--radius-sheet,28px)] px-5 pb-5 pt-6 outline-none"
      >
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost absolute right-3 top-3 min-h-11 min-w-11 rounded-full text-[13px]" aria-label="Close">
          ✕
        </button>
        <button
          type="button"
          onClick={orbTap}
          aria-label={rt.live ? STATUS[rt.phase] : 'Start talking'}
          className="rounded-full focus-visible:shadow-[var(--focus-ring)]"
        >
          <SunOrb levels={rt.levels} size={typing ? 120 : 220} active={rt.live} />
        </button>
        <p className="eyebrow" aria-live="polite">{voiceOff ? 'Typing' : typing && rt.live ? 'Typing' : STATUS[rt.phase]}</p>

        <ol className="flex max-h-48 w-full flex-col gap-1.5 overflow-y-auto text-[14px] leading-snug" aria-live="polite">
          {rt.lines.map((line, i) => (
            <li
              key={i}
              className={
                line.who === 'you'
                  ? 'self-end rounded-2xl bg-surface-3 px-3 py-1.5 text-bone'
                  : line.who === 'done'
                    ? 'self-center text-[12px] text-saffron'
                    : 'self-start text-ink-soft'
              }
            >
              {line.text}
            </li>
          ))}
          {notes.map((note, i) => (
            <li key={`n${i}`} className="self-start text-ink-soft">{note}</li>
          ))}
        </ol>
        {rt.error && rt.phase === 'error' && !voiceOff && <p className="notice w-full text-[13px]">{rt.error}</p>}
        {voiceOff && <p className="notice w-full text-[13px]">Voice isn’t set up on this site yet. Type below; it does the same things.</p>}

        {typing ? (
          <form onSubmit={submit} className="flex w-full gap-2">
            <input
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={1000}
              placeholder={page?.intent === 'trip' ? 'Lisbon, second week of October, me and Sam' : page?.intent === 'board' ? 'Tell us about you' : 'Say it in words'}
              className="field min-h-11 flex-1"
              aria-label="Type to dope.travel"
            />
            <button type="submit" className="btn-primary min-h-11 px-4">Send</button>
          </form>
        ) : (
          <button type="button" onClick={switchToTyping} className="min-h-11 text-[12px] text-ink-subtle underline-offset-4 hover:text-ink-soft hover:underline">
            Type instead like a caveman
          </button>
        )}
        <p className="text-center text-[11px] leading-snug text-ink-subtle">
          Your voice goes to OpenAI to be understood. dope.travel keeps nothing you say; changes happen on this device.
        </p>
      </div>
    </div>
  );
}

/** The sun button that opens the concierge. */
export function SunButton({ label = 'Talk', className = '' }: { label?: string; className?: string }) {
  const setOpen = useVoiceStore((s) => s.setOpen);
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full bg-surface-2 px-3.5 text-[13px] font-medium text-bone shadow-soft-1 hover:bg-surface-3 ${className}`}
      aria-label={label === 'Talk' ? 'Talk to dope.travel' : label}
    >
      <span aria-hidden="true" className="relative inline-block h-5 w-5 overflow-hidden rounded-full" style={{ background: 'linear-gradient(180deg,#f7c548 0%,#f26b2a 55%,#e4577e 100%)' }}>
        <span className="absolute inset-x-0 top-[62%] h-[1.5px] bg-[#1a0b06]" />
        <span className="absolute inset-x-0 top-[78%] h-[2px] bg-[#1a0b06]" />
      </span>
      {label}
    </button>
  );
}
