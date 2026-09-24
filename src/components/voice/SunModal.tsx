'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useHydrated } from '@/components/designer/useHydrated';
import { pickActiveProfile, profileLabel, useDesignerStore } from '@/lib/designer/store';
import { planTripHref } from '@/lib/search/planPlace';
import { useVoiceStore, type VoiceHandlers } from '@/lib/voice/registry';
import { INTENT_TOOLS, routeFor } from '@/lib/voice/tools';
import { readTypedVibe, vibeTarget, type VibeTarget } from '@/lib/voice/vibe';
import { useRealtime, type VoicePhase } from '@/lib/voice/useRealtime';
import { SunOrb } from './SunOrb';

type PageVoice = NonNullable<ReturnType<typeof useVoiceStore.getState>['page']>;

/** Open the page that owns a tool (if it isn't open) and wait for it to register. */
function waitForPage(intent: VibeTarget['intent'], timeoutMs = 10_000): Promise<PageVoice | null> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      unsubscribe();
      resolve(null);
    }, timeoutMs);
    const unsubscribe = useVoiceStore.subscribe((state) => {
      if (state.page?.intent !== intent) return;
      window.clearTimeout(timer);
      unsubscribe();
      resolve(state.page);
    });
  });
}

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
 * The voice concierge behind the header's Vibe button. It captures the
 * profile or starts a trip from any page: a tool that belongs to another page
 * opens that page and runs through what it registered (useVoicePage). Typing
 * works over the same live session, or, when voice isn't set up, is routed on
 * the device: talk about yourself builds the profile, a place starts a trip.
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
  const hasProfile = useDesignerStore((s) => s.profiles.length > 0);

  const reach = useCallback(async (target: VibeTarget): Promise<PageVoice | null> => {
    const here = useVoiceStore.getState().page;
    if (here?.intent === target.intent) return here;
    const ready = waitForPage(target.intent);
    router.push(target.href);
    return ready;
  }, [router]);

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
    const forwarded: VoiceHandlers = {};
    for (const name of INTENT_TOOLS.vibe) {
      forwarded[name] = async (args) => {
        const target = vibeTarget(name, args);
        if (!target) return 'Error: nothing to do there.';
        const owner = await reach(target);
        const run = owner?.handlers[name];
        return run ? run(args) : 'Error: that page did not open in time. Ask them to try again.';
      };
    }
    return { ...forwarded, navigate, switch_profile: switchProfile };
  }, [reach, router]);

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
      intent: 'vibe',
      context: context(),
      handlers: handlers(),
      withMic,
      textOnly: !withMic,
    });
    if (result === 'mic-denied') {
      setTyping(true);
      setNotes(['No microphone, so we’ll type. Allow the mic in your browser to talk instead.']);
      void rt.start({ intent: 'vibe', context: context(), handlers: handlers(), withMic: false, textOnly: true });
    } else if (result === 'not-configured') {
      setVoiceOff(true);
      setTyping(true);
    }
  }, [context, handlers, rt]);

  // Start listening as soon as the modal opens (the tap that opened it is the gesture).
  const beginRef = useRef(begin);
  const stopRef = useRef(rt.stop);
  useEffect(() => {
    let cancelled = false;
    void fetch('/api/voice/session', { cache: 'no-store' })
      .then((response) => (response.ok ? (response.json() as Promise<{ enabled?: boolean }>) : { enabled: false }))
      .catch(() => ({ enabled: false }))
      .then(({ enabled }) => {
        if (cancelled) return;
        if (enabled) void beginRef.current(true);
        else {
          setVoiceOff(true);
          setTyping(true);
        }
      });
    const stop = stopRef.current;
    return () => {
      cancelled = true;
      stop('idle');
    };
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
    const note = (line: string) => setNotes((prev) => [...prev.slice(-5), `You: ${text}`, line]);
    const read = readTypedVibe(text, hasProfile);
    const here = useVoiceStore.getState().page;
    // On the trip designer or Now, a typed place fills that page in place.
    if (read.kind === 'trip' && here?.fallback && (here.intent === 'trip' || here.intent === 'now')) {
      note(await here.fallback(text));
      return;
    }
    if (read.kind === 'trip') {
      setOpen(false);
      router.push(read.place ? planTripHref(read.place) : '/trips/designer');
      return;
    }
    if (text.length < 10) {
      note('Tell me a little more: where home is, what’s on repeat, how you eat, who you travel with.');
      return;
    }
    note('Building your vibe…');
    const board = await reach({ intent: 'board', href: '/moodboard' });
    const reply = board?.handlers.describe_me ? await board.handlers.describe_me({ summary: text }) : 'Error: the profile page did not open. Try again.';
    if (reply.startsWith('Error')) note(reply.replace(/^Error:\s*/, ''));
    else setOpen(false);
  };

  const orbTap = () => {
    if (voiceOff || rt.live || rt.phase === 'connecting') return;
    setTyping(false);
    void begin(true);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center" onClick={() => setOpen(false)}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={hasProfile ? 'Vibe' : 'Set your vibe'}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="surface relative flex w-full max-w-[420px] flex-col items-center gap-4 rounded-[var(--radius-sheet,28px)] px-5 pb-5 pt-6 outline-none"
      >
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost absolute right-3 top-3 w-11 p-0 text-[13px]" aria-label="Close">
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
        {rt.lines.length === 0 && notes.length === 0 && (
          <p className="text-center text-[14px] leading-snug text-ink-soft">
            {hasProfile
              ? 'Where to next? Say where, when, and who’s coming. Or tell me something new about you.'
              : 'Tell us how you get down: where home is, who you root for, what’s on repeat, how you eat, and who you travel with.'}
          </p>
        )}

        {typing ? (
          <form onSubmit={submit} className="flex w-full gap-2">
            <input
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={1000}
              placeholder={hasProfile ? 'Lisbon, second week of October, me and Sam' : 'I’m from Atlanta, Braves fan, omakase or taco trucks…'}
              className="field min-h-11 flex-1"
              aria-label="Type to dope.travel"
            />
            <button type="submit" className="btn btn-primary">Send</button>
          </form>
        ) : (
          <button type="button" onClick={switchToTyping} className="min-h-11 text-[12px] text-ink-subtle underline-offset-4 hover:text-ink-soft hover:underline">
            Type instead like a caveman
          </button>
        )}
        <p className="text-center text-[11px] leading-snug text-ink-subtle">
          {voiceOff
            ? 'What you type stays on this device.'
            : 'Your voice goes to OpenAI to be understood. dope.travel keeps nothing you say; changes happen on this device.'}
        </p>
      </div>
    </div>
  );
}

/** The sun button that opens the concierge. */
export function SunButton({ className = '' }: { className?: string }) {
  const setOpen = useVoiceStore((s) => s.setOpen);
  const hydrated = useHydrated();
  const hasProfile = useDesignerStore((s) => s.profiles.length > 0);
  // Before a profile exists the button invites one; after, it's the way in to everything else.
  const label = hydrated && hasProfile ? 'Vibe' : 'Set your vibe';
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full bg-surface-2 px-3 sm:px-3.5 text-[13px] font-medium text-bone shadow-soft-1 hover:bg-surface-3 ${className}`}
      aria-label={label}
    >
      <span aria-hidden="true" className="relative inline-block h-5 w-5 overflow-hidden rounded-full" style={{ background: 'linear-gradient(180deg,#f7c548 0%,#f26b2a 55%,#e4577e 100%)' }}>
        <span className="absolute inset-x-0 top-[62%] h-[1.5px] bg-[#1a0b06]" />
        <span className="absolute inset-x-0 top-[78%] h-[2px] bg-[#1a0b06]" />
      </span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
