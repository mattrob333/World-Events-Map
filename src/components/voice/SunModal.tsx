'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHydrated } from '@/components/designer/useHydrated';
import { MAX_RAMBLE_CHARS, parseProfileLocally } from '@/lib/designer/profile';
import { pickActiveProfile, profileLabel, useDesignerStore } from '@/lib/designer/store';
import { planTripHref, type PlanPlace } from '@/lib/search/planPlace';
import { useVoiceStore, type VoiceHandlers } from '@/lib/voice/registry';
import { INTENT_TOOLS, routeFor } from '@/lib/voice/tools';
import { readTrip, whenLabel } from '@/lib/voice/tripBrief';
import { vibeTarget, type VibeTarget } from '@/lib/voice/vibe';
import { checklistFor, type ChecklistItem, type VibeMode } from '@/lib/voice/vibeChecklist';
import { topicsFor } from '@/lib/voice/topics';
import { useRealtime } from '@/lib/voice/useRealtime';
import { useModalFocus } from '@/components/shell/useModalFocus';
import { SunOrb } from './SunOrb';
import { VibePlaces, type VibePayload } from './VibePlaces';
import { useLiveTranscript } from './useLiveTranscript';

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

/**
 * The Vibe stage behind the header's sun and the "Set your vibe" prompt: a
 * full-screen place to talk, not a text box with a mic.
 */
export function SunModal() {
  const open = useVoiceStore((s) => s.open);
  return open ? <VibeStage /> : null;
}

type Phase = 'intro' | 'talking' | 'recap' | 'typing' | 'building';

type Recommendation = { id: string; name: string; city: string; country: string; start?: string; end?: string; when: string; planBy: string | null; reason: string | null; slug: string | null };

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** An event's dates as a plan link: its first day (or today, if it's already on) and how many nights it runs, 2 to 7. */
function eventPlan(rec: Recommendation, today: string): PlanPlace {
  const plan: PlanPlace = { place: rec.city, region: rec.country };
  if (!rec.start || !rec.end) return plan;
  const start = rec.start > today ? rec.start : today;
  const nights = Math.round((Date.parse(`${rec.end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
  return { ...plan, start, nights: Math.max(2, Math.min(7, nights || 2)) };
}

/** "Dec 19" becomes "Dec 19, 2026" when it isn't this year. */
function withYear(when: string, start: string | undefined, today: string) {
  if (!start || start.slice(0, 4) === today.slice(0, 4) || /\b\d{4}\b/.test(when)) return when;
  return `${when}, ${start.slice(0, 4)}`;
}

/** "Dec 19" from "2026-12-19". */
function shortDay(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** The concierge's first words, every time: the bullets on screen are the agenda. */
const OPENER = 'Vibe with me for a second about the topics above.';

/** Everything they said, for building when the concierge wasn't asked to (or they tapped I'm done first). */
function tripTextFrom(facts: Record<string, string>, said: string): string {
  if (!facts.where) return said;
  const parts = [`Trip to ${facts.where}`, facts.when, facts.who ? `with ${facts.who}` : '', facts.vibe, facts.must].filter(Boolean);
  return `${parts.join(', ')}.`;
}

function profileTextFrom(facts: Record<string, string>, said: string): string {
  const locked = topicsFor('profile').filter((topic) => facts[topic.key]).map((topic) => `${topic.label}: ${facts[topic.key]}.`).join(' ');
  return [said, locked].filter(Boolean).join(' ').slice(0, MAX_RAMBLE_CHARS);
}

const COPY: Record<VibeMode, { kicker: string; title: string; lede: string; build: string; placeholder: string }> = {
  profile: {
    kicker: 'My profile',
    title: 'Tell us how you get down.',
    lede: 'Talk through these. A few quick follow-ups, then it’s built.',
    build: 'Build my vibe',
    placeholder: 'I’m from Atlanta, Braves fan, Fred again.. on repeat, omakase or taco trucks, and I travel with…',
  },
  trip: {
    kicker: 'A trip',
    title: 'All right, let’s vibe.',
    lede: 'Where, when and who are enough to start.',
    build: 'Build the trip',
    placeholder: 'Lisbon, second week of October, me and Sam. One great seafood lunch, no touristy fado.',
  },
};

function VibeStage() {
  const setOpen = useVoiceStore((s) => s.setOpen);
  const page = useVoiceStore((s) => s.page);
  const router = useRouter();
  const rt = useRealtime();
  const dictation = useLiveTranscript();
  const hasProfile = useDesignerStore((s) => s.profiles.length > 0);
  const [mode, setMode] = useState<VibeMode>(hasProfile ? 'trip' : 'profile');
  const [phase, setPhase] = useState<Phase>('intro');
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [recs, setRecs] = useState<Recommendation[] | null>(null);
  const [vibe, setVibe] = useState<VibePayload | null>(null);
  const [recMonth, setRecMonth] = useState<string | null>(null);
  const [recWhere, setRecWhere] = useState<string[]>([]);
  const [rulesDecided, setRulesDecided] = useState(false);
  const [usedSpeech, setUsedSpeech] = useState(false);
  const [facts, setFacts] = useState<Record<string, string>>({});
  const [muted, setMuted] = useState(false);
  // Something to do once the concierge stops talking (build the trip, close on the board).
  const afterSpeech = useRef<(() => void) | null>(null);
  const phaseRef = useRef(rt.phase);
  const finishRef = useRef<() => void>(() => undefined);
  const factsRef = useRef<Record<string, string>>({});
  const aiSaidRef = useRef('');
  const buildRef = useRef<(text?: string) => Promise<void>>(async () => undefined);
  // Run what's waiting once the concierge's last sentence has played (or after 8 seconds regardless).
  const lastSpoke = useRef(0);
  const pendingSince = useRef(0);
  useEffect(() => {
    phaseRef.current = rt.phase;
    if (rt.phase === 'speaking') lastSpoke.current = Date.now();
  }, [rt.phase]);
  const whenQuiet = useCallback((next: () => void) => {
    pendingSince.current = Date.now();
    lastSpoke.current = Date.now();
    afterSpeech.current = next;
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = afterSpeech.current;
      if (!next) return;
      const now = Date.now();
      const quiet = phaseRef.current !== 'speaking' && now - lastSpoke.current > 900;
      if (quiet || now - pendingSince.current > 8000) {
        afterSpeech.current = null;
        next();
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, []);

  const dialogRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const openedOn = useRef(pathname);
  useModalFocus(dialogRef);
  const transcriptEnd = useRef<HTMLSpanElement>(null);
  const copy = COPY[mode];

  // ── Routing shared by the live AI conversation and the dictation path ──────
  const reach = useCallback(async (target: VibeTarget): Promise<PageVoice | null> => {
    const here = useVoiceStore.getState().page;
    if (here?.intent === target.intent) return here;
    const ready = waitForPage(target.intent);
    // The concierge opened this page mid-conversation; the stage stays up until it's done talking.
    openedOn.current = target.href.split('?')[0]!;
    router.push(target.href);
    return ready;
  }, [router]);

  const handlers = useCallback((): VoiceHandlers => {
    const navigate: VoiceHandlers['navigate'] = (args) => {
      const href = routeFor(args.to);
      if (!href) return 'I can’t open that.';
      openedOn.current = href.split('?')[0]!;
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
    const topicKeys = new Set(topicsFor(mode).map((topic) => topic.key));
    const lockFact: VoiceHandlers['lock_fact'] = (args) => {
      const topic = typeof args.topic === 'string' ? args.topic : '';
      const fact = typeof args.fact === 'string' ? args.fact.replace(/\s+/g, ' ').trim().slice(0, 80) : '';
      if (!topicKeys.has(topic) || !fact) return 'Error: that topic is not on their screen.';
      setFacts((prev) => ({ ...prev, [topic]: fact }));
      return 'Locked.';
    };
    const finishTrip: VoiceHandlers['finish_trip'] = () => {
      finishRef.current();
      return 'END: Building it now.';
    };
    const describeMe: VoiceHandlers['describe_me'] = async (args) => {
      const reply = await forwarded.describe_me!(args);
      if (reply.startsWith('Error')) return reply;
      // The board is on screen behind the stage; close once the concierge finishes its sentence.
      whenQuiet(() => { rt.stop('ended'); setOpen(false); });
      return `END: ${reply}`;
    };
    return mode === 'profile'
      ? { lock_fact: lockFact, describe_me: describeMe, switch_profile: switchProfile }
      : mode === 'trip'
        ? { lock_fact: lockFact, finish_trip: finishTrip, switch_profile: switchProfile }
        : { ...forwarded, navigate, switch_profile: switchProfile };
  }, [reach, router, mode, rt, setOpen, whenQuiet]);

  const context = useCallback(() => {
    const { profiles, activeProfileId } = useDesignerStore.getState();
    const active = pickActiveProfile(profiles, activeProfileId);
    const who = active
      ? `Traveling as ${profileLabel(active)}${active.profile.name ? ` (${active.profile.name})` : ''}. Profiles on this device: ${profiles.map(profileLabel).join(', ')}.`
      : 'No travel profile yet.';
    return [who, page?.context() ?? ''].filter(Boolean).join(' ');
  }, [page]);

  // ── Setup: is the live AI voice on for this site? ──────────────────────────
  const stopRealtime = useRef(rt.stop);
  useEffect(() => {
    let cancelled = false;
    void fetch('/api/voice/session', { cache: 'no-store' })
      .then((response) => (response.ok ? (response.json() as Promise<{ enabled?: boolean }>) : { enabled: false }))
      .catch(() => ({ enabled: false }))
      .then(({ enabled }) => { if (!cancelled) setVoiceEnabled(Boolean(enabled)); });
    const stop = stopRealtime.current;
    return () => {
      cancelled = true;
      stop('idle');
    };
  }, []);

  // Leaving the page (Back, a link) closes the stage and stops listening.
  useEffect(() => {
    if (pathname !== openedOn.current) setOpen(false);
  }, [pathname, setOpen]);

  useEffect(() => {
    dialogRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  // ── What was said so far ────────────────────────────────────────────────────
  const aiSaid = rt.lines.filter((line) => line.who === 'you').map((line) => line.text).join(' ');
  const spoken = voiceEnabled ? aiSaid : dictation.text;
  const live = voiceEnabled ? rt.live : dictation.status === 'listening';
  const checklist = useMemo(() => checklistFor(mode, `${spoken} ${dictation.interim}`, voiceEnabled ? facts : {}), [mode, spoken, dictation.interim, facts, voiceEnabled]);
  const covered = checklist.filter((item) => item.done).length;

  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [spoken, dictation.interim, rt.lines.length]);

  // A blocked mic or a dead speech service drops straight to typing, said plainly.
  const micProblem = voiceEnabled ? null
    : dictation.status === 'denied' ? 'The microphone is blocked for this site. Allow it in your browser settings, or type it in the box.'
    : dictation.status === 'error' ? 'Speech-to-text stopped working. Type the rest in the box.'
    : null;
  const view: Phase = micProblem && phase === 'talking' ? 'typing' : phase;
  const shownNote = note ?? (view === 'typing' ? micProblem : null);

  /** Voice trip: stop listening once the concierge has said "Got it.", then build from the locked facts. */
  const finishTrip = () => {
    whenQuiet(() => {
      rt.stop('ended');
      const text = tripTextFrom(factsRef.current, aiSaidRef.current);
      dictation.setText(text);
      void buildRef.current(text);
    });
  };
  useEffect(() => {
    finishRef.current = finishTrip;
    factsRef.current = facts;
    aiSaidRef.current = aiSaid;
  });

  const startTalking = async () => {
    setNote(null);
    setRecs(null);
    setVibe(null);
    setRulesDecided(false);
    setUsedSpeech(true);
    setPhase('talking');
    if (!voiceEnabled) {
      dictation.start();
      return;
    }
    setFacts({});
    setMuted(false);
    afterSpeech.current = null;
    const result = await rt.start({ intent: mode === 'profile' ? 'vibe_profile' : 'vibe_trip', context: context(), handlers: handlers(), withMic: true, textOnly: false, opener: OPENER });
    if (result === 'mic-denied') {
      setNote('The microphone is blocked for this site. Allow it in your browser settings, or type it in the box.');
      setPhase('typing');
    } else if (result === 'not-configured') {
      setVoiceEnabled(false);
      dictation.start();
    }
  };

  const done = () => {
    if (voiceEnabled) {
      const said = aiSaid;
      rt.stop('ended');
      afterSpeech.current = null;
      if (mode === 'trip') {
        const text = tripTextFrom(facts, said);
        dictation.setText(text);
        if (text.trim().length >= 10) void buildRef.current(text);
        else setPhase('recap');
        return;
      }
      // Profile: build from what was said and locked, even if the concierge hadn't got there yet.
      const text = profileTextFrom(facts, said);
      dictation.setText(text);
      if (text.trim().length >= 10) void buildRef.current(text);
      else setPhase('recap');
      return;
    }
    dictation.stop();
    setPhase('recap');
  };

  // Escape or ✕: while talking, stop and show what was heard; with words on
  // the page, ask before throwing them away.
  const close = () => {
    if (phase === 'talking' && !voiceEnabled && (dictation.text || dictation.interim)) {
      done();
      return;
    }
    if (phase !== 'building' && !voiceEnabled && dictation.text.trim().length >= 10 && !window.confirm('Close and lose what you said?')) return;
    setOpen(false);
  };
  const closeRef = useRef(close);
  useEffect(() => { closeRef.current = close; });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const build = async (override?: string) => {
    const text = (override ?? dictation.text).trim();
    setRecs(null);
    setVibe(null);
    setNote(null);
    setRulesDecided(false);
    if (text.length < 10) {
      setNote(mode === 'profile' ? 'Say a bit more first: where home is, what you love, who you travel with.' : 'Say where you’re thinking of going first.');
      return;
    }
    setPhase('building');
    if (mode === 'trip') {
      // trip-router@1 decides what they asked for before anything else runs.
      type Routed = { route: 'plan' | 'recommend' | 'follow_up'; question?: string; recommendations?: Recommendation[]; place?: PlanPlace | null; month?: string | null; where?: string[]; vibe?: VibePayload; decidedBy?: 'jev' | 'rules' };
      let routed: Routed | null = null;
      try {
        const response = await fetch('/api/designer/route-trip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, hasProfile, today: localToday() }),
        });
        routed = response.ok ? ((await response.json()) as Routed) : null;
      } catch {
        routed = null;
      }
      setRulesDecided(routed?.decidedBy === 'rules');
      if (routed?.route === 'follow_up' && routed.question) {
        setNote(routed.question);
        setPhase('recap');
        return;
      }
      if (routed?.route === 'recommend') {
        setRecs(routed.recommendations ?? []);
        setVibe(routed.vibe ?? null);
        setRecMonth(routed.month ?? null);
        setRecWhere(routed.where ?? []);
        setPhase('recap');
        return;
      }
      const place = routed?.place ?? readTrip(text, localToday()).place;
      const here = useVoiceStore.getState().page;
      if (!place && here?.intent === 'trip' && here.fallback) await here.fallback(text);
      else router.push(place ? planTripHref(place) : '/trips/designer');
      setOpen(false);
      return;
    }
    const board = await reach({ intent: 'board', href: '/moodboard' });
    const reply = board?.handlers.describe_me ? await board.handlers.describe_me({ summary: text }) : 'Error: the profile page did not open. Try again.';
    if (reply.startsWith('Error')) {
      setNote(reply.replace(/^Error:\s*/, ''));
      setPhase('recap');
    } else {
      setOpen(false);
    }
  };

  useEffect(() => { buildRef.current = build; });

  const recapFacts = useMemo(() => {
    if (view !== 'recap' || mode !== 'profile') return [];
    const p = parseProfileLocally(dictation.text);
    const crew = p.family.map((member) => `${member.name ?? member.label}${member.age !== undefined ? ` (${member.age})` : ''}`).join(', ');
    return [
      ['Home', p.hometown],
      ['Teams', p.teams.join(', ')],
      ['Music', [...(p.artists ?? []), ...p.music].slice(0, 4).join(', ')],
      ['Food', p.food.join(', ')],
      ['Crew', crew],
    ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  }, [view, mode, dictation.text]);
  const today = localToday();
  const brief = useMemo(() => (mode === 'trip' && (view === 'recap' || view === 'building') ? readTrip(dictation.text, today) : null), [mode, view, dictation.text, today]);
  const recapPlace = brief && !recs ? brief.place : null;
  const tripFacts: [string, string][] = brief ? ([
    ['Where', brief.place ? [brief.place.place, brief.place.region].filter(Boolean).join(', ') : brief.wheres.map((where) => where.label).join(', ')],
    ['When', whenLabel(brief.when) ?? ''],
    ['Who', brief.crew?.label ?? ''],
    ['Trip', brief.tripType ? brief.tripType.replace('-', ' ') : ''],
  ] as [string, string][]).filter(([, value]) => Boolean(value)) : [];
  const whereLabel = recWhere.length ? recWhere.join(' or ') : null;
  const planWith = (plan: PlanPlace): PlanPlace => ({ ...plan, ...(brief?.crew ? { who: brief.crew.label } : {}) });
  const monthLabel = recMonth ? MONTH_NAMES[Number(recMonth.slice(5, 7)) - 1] : null;

  const orbLevels = useCallback(() => (voiceEnabled ? rt.levels() : { mic: dictation.activity(), sun: 0 }), [voiceEnabled, rt, dictation]);
  const canTalk = voiceEnabled || dictation.supported;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={copy.kicker}
      tabIndex={-1}
      className="vibe-stage fixed inset-0 z-[80] flex flex-col text-bone outline-none"
    >
      {/* Top bar: what we're capturing, and a way out. */}
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:px-8">
        <div className="flex gap-1 rounded-full bg-surface-1/80 p-1" role="tablist" aria-label="What are we talking about?">
          {(['profile', 'trip'] as const).map((value) => (
            <button
              key={value}
              id={`vibe-tab-${value}`}
              type="button"
              role="tab"
              aria-selected={mode === value}
              aria-controls="vibe-panel"
              disabled={view === 'talking' || view === 'building'}
              onClick={() => setMode(value)}
              className={`min-h-10 rounded-full px-4 text-[13px] font-medium transition-colors ${mode === value ? 'bg-surface-3 text-bone' : 'text-ink-muted hover:text-bone'}`}
            >
              {value === 'profile' ? 'My profile' : 'A trip'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {voiceEnabled && view === 'talking' && live && (
            <button
              type="button"
              onClick={() => { rt.setTextOnly(!muted); setMuted(!muted); }}
              aria-pressed={muted}
              className="flex min-h-11 items-center rounded-full bg-surface-1/80 px-4 text-[13px] text-ink-soft hover:text-bone"
            >
              {muted ? 'Unmute' : 'Mute voice'}
            </button>
          )}
          <button type="button" onClick={close} className="flex size-11 items-center justify-center rounded-full bg-surface-1/80 text-[15px] text-ink-soft hover:text-bone" aria-label="Close">
            ✕
          </button>
        </div>
      </div>

      <div id="vibe-panel" role="tabpanel" aria-labelledby={`vibe-tab-${mode}`} className="mx-auto flex w-full max-w-[760px] flex-1 flex-col overflow-hidden px-5 sm:px-8">
        {view === 'intro' ? (
          <div className="flex flex-1 flex-col overflow-y-auto pb-2 pt-2 sm:pt-10">
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-saffron">{copy.kicker}</p>
            <h2 className="mt-2 font-display text-[36px] leading-[1.02] tracking-[-0.01em] sm:text-[60px]">{copy.title}</h2>
            <p className="mt-2 max-w-[34ch] text-[15px] leading-snug text-ink-soft sm:mt-3 sm:text-[18px]">{copy.lede}</p>
            <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-muted sm:mt-7">Start with</p>
            <TopicList items={checklist} />
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden pt-2">
            <p className="sr-only" role="status">{covered} of {checklist.length} covered</p>
            {view === 'talking' ? (
              // While talking, the bullets are the agenda: each lights up with what was locked for it.
              <div className="overflow-y-auto">
                <TopicList items={checklist} live />
              </div>
            ) : (
            <ul className="flex flex-wrap gap-1.5" aria-label="What’s covered">
              {checklist.map((item) => (
                <li
                  key={item.key}
                  className={`flex min-h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-colors duration-300 ${item.done ? 'bg-saffron/15 text-saffron' : 'bg-surface-1/80 text-ink-muted'}`}
                >
                  <span aria-hidden="true">{item.done ? '✓' : '○'}</span>
                  {item.label}
                </li>
              ))}
            </ul>
            )}

            {view === 'recap' || view === 'typing' || view === 'building' ? (
              <div className="mt-5 flex flex-1 flex-col overflow-y-auto pb-3">
                {view !== 'typing' && (
                  <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-saffron">
                    {view === 'building' ? 'On it' : recs ? (vibe ? 'Where your week is' : 'Ideas from our calendar') : 'Here’s what I heard'}
                  </p>
                )}
                {recs && vibe && (vibe.places.length > 0 || vibe.alsoInRange.length > 0) && (
                  <div aria-live="polite">
                    <VibePlaces
                      vibe={vibe}
                      onPlan={(plan) => { router.push(planTripHref(planWith(plan))); setOpen(false); }}
                      onSee={(href) => { router.push(href); setOpen(false); }}
                    />
                  </div>
                )}
                {recs && !(vibe && (vibe.places.length > 0 || vibe.alsoInRange.length > 0)) && (
                  <div className="mt-3 flex flex-col gap-2" aria-live="polite">
                    {recs.length ? (
                      <>
                        <p className="text-[15px] text-ink-soft">
                          {`On our calendar${whereLabel ? ` in ${whereLabel}` : ''}${monthLabel ? ` in ${monthLabel}` : whereLabel ? '' : ' now and coming up'}:`}
                        </p>
                        {recs.map((rec) => (
                          <div key={rec.id} className="rounded-[18px] bg-surface-1/80 p-4">
                            <p className="font-display text-[22px] leading-tight text-bone">{rec.city}<span className="text-ink-soft">, {rec.country}</span></p>
                            <p className="mt-0.5 text-[13px] text-ink-soft">{rec.name} · <span className="text-saffron">{recMonth && rec.start && rec.end && rec.start < `${recMonth}-01` ? `runs ${shortDay(rec.start)} – ${shortDay(rec.end)}` : withYear(rec.when, rec.start, today)}</span>{rec.planBy ? ` · ${rec.planBy}` : ''}</p>
                            {rec.reason && <p className="mt-1 text-[13px] text-ink-muted">{rec.reason}</p>}
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button type="button" className="btn btn-primary btn-sm" onClick={() => { router.push(planTripHref(planWith(eventPlan(rec, today)))); setOpen(false); }}>Plan this</button>
                              {rec.slug && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { router.push(`/destinations/${rec.slug}?event=${encodeURIComponent(rec.id)}`); setOpen(false); }}>See the place</button>}
                            </div>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="flex flex-col gap-3">
                        <p className="text-[15px] text-ink-soft">
                          Nothing on our calendar fits that{whereLabel ? ` in ${whereLabel}` : ''}{monthLabel ? ` in ${monthLabel}` : whereLabel ? '' : ' right now'}. Name a town or resort and I’ll plan it directly.
                        </p>
                        {recWhere.length === 1 && brief?.wheres[0] && brief.wheres[0].kind !== 'region' && (
                          <button type="button" className="btn btn-primary btn-sm self-start" onClick={() => { router.push(planTripHref(planWith({ place: brief.wheres[0]!.label, start: brief.when.start, nights: brief.when.nights }))); setOpen(false); }}>
                            Plan {brief.wheres[0].label} anyway
                          </button>
                        )}
                      </div>
                    )}
                    <p className="text-[12px] leading-4 text-ink-subtle">From our events calendar, which doesn’t list every resort or town yet.</p>
                  </div>
                )}
                {tripFacts.length > 0 && (
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[15px]">
                    {tripFacts.map(([label, value]) => (
                      <div key={label} className="contents">
                        <dt className="text-ink-muted">{label}</dt>
                        <dd className="text-bone">{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {recapFacts.length > 0 && (
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[15px]">
                    {recapFacts.map(([label, value]) => (
                      <div key={label} className="contents">
                        <dt className="text-ink-muted">{label}</dt>
                        <dd className="text-bone">{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {recapPlace && (
                  <p className="mt-3 font-display text-[28px] leading-tight">
                    {recapPlace.place}{recapPlace.region ? <span className="text-ink-soft">, {recapPlace.region}</span> : null}
                  </p>
                )}
                <label className="mt-4 flex flex-1 flex-col">
                  <span className="text-[12px] text-ink-muted">{view === 'typing' ? 'Type it like you’d say it' : 'Tap to fix anything I got wrong'}</span>
                  <textarea
                    value={dictation.text}
                    onChange={(event) => { dictation.setText(event.target.value.slice(0, MAX_RAMBLE_CHARS)); if (note) setNote(null); }}
                    maxLength={MAX_RAMBLE_CHARS}
                    placeholder={copy.placeholder}
                    autoFocus={view === 'typing'}
                    disabled={view === 'building'}
                    className="mx-1 mt-2 min-h-[9rem] flex-1 resize-none rounded-[20px] bg-surface-1/80 p-4 font-display text-[20px] leading-snug text-bone outline-none placeholder:text-ink-subtle focus-visible:shadow-[var(--focus-ring)] sm:text-[22px]"
                  />
                </label>
              </div>
            ) : (
              <div className="mt-4 min-h-[5.5rem] flex-1 overflow-y-auto border-t border-white/5 pb-3 pt-3">
                {voiceEnabled ? (
                  <ol className="flex flex-col gap-2 text-[16px] leading-snug sm:text-[19px]" aria-live="polite">
                    {rt.lines.filter((line) => line.who !== 'done').slice(-4).map((line, i) => (
                      <li key={i} className={line.who === 'you' ? 'text-bone' : 'font-display text-[18px] text-saffron sm:text-[21px]'}>
                        {line.text}
                      </li>
                    ))}
                    {!rt.lines.length && <li className="text-ink-subtle">{rt.phase === 'connecting' ? 'Connecting…' : 'Listening…'}</li>}
                  </ol>
                ) : (
                  <p className="font-display text-[28px] leading-[1.18] sm:text-[36px]">
                    {dictation.text && <span className="text-bone">{dictation.text} </span>}
                    {dictation.interim && <span className="text-ink-muted">{dictation.interim}</span>}
                    {!dictation.text && !dictation.interim && <span className="text-ink-subtle">Listening… start with {checklist.find((item) => !item.done)?.label.toLowerCase() ?? 'anything'}.</span>}
                  </p>
                )}
                <span ref={transcriptEnd} />
              </div>
            )}
          </div>
        )}

        {shownNote && <p className="notice mb-3 text-[13px]" role="status">{shownNote}</p>}
        {rulesDecided && (view === 'recap' || view === 'typing') && (
          <p className="mb-3 text-[12px] leading-4 text-ink-muted">Matched with simple word rules for now. Name a place, or a kind of trip (beach, snow, food, surf, nights out).</p>
        )}
      </div>

      {/* The dock: the sun is the button. */}
      <div className="mx-auto flex w-full max-w-[760px] flex-col items-center gap-3 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2 sm:px-8">
        {view === 'intro' && (
          <>
            {canTalk ? (
              <button type="button" onClick={() => void startTalking()} className="group flex flex-col items-center gap-2 rounded-full focus-visible:shadow-[var(--focus-ring)]" aria-label="Start talking">
                <SunOrb size={112} active={false} />
                <span className="text-[15px] font-semibold text-bone">Tap to start talking</span>
              </button>
            ) : (
              <p className="text-center text-[13px] text-ink-soft">This browser can’t turn speech into text. Chrome, Edge and Safari can.</p>
            )}
            <button type="button" onClick={() => { setNote(null); setPhase('typing'); }} className={canTalk ? 'min-h-11 text-[13px] text-ink-muted underline-offset-4 hover:text-ink-soft hover:underline' : 'btn btn-primary'}>
              {canTalk ? 'Type instead' : 'Type it'}
            </button>
          </>
        )}

        {view === 'talking' && (
          <div className="flex w-full items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => (live ? (voiceEnabled ? rt.stop('ended') : dictation.stop()) : void startTalking())}
              className="flex min-h-12 min-w-24 items-center justify-center rounded-full bg-surface-1/80 px-4 text-[14px] text-ink-soft hover:text-bone"
            >
              {live ? 'Pause' : 'Resume'}
            </button>
            <div className="flex flex-col items-center">
              <SunOrb size={96} active={live} levels={orbLevels} />
              <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-saffron">
                {voiceEnabled && rt.phase === 'connecting' ? 'Connecting' : !live && !(voiceEnabled && rt.phase === 'connecting') ? 'Paused' : voiceEnabled && rt.phase === 'speaking' ? (muted ? 'Replying' : 'Speaking') : 'Listening'}
              </span>
            </div>
            <button type="button" onClick={done} className="btn btn-primary min-h-12 min-w-24">
              I’m done
            </button>
          </div>
        )}

        {(view === 'recap' || view === 'typing') && (
          <div className="flex w-full items-center justify-between gap-3">
            {canTalk ? (
              <button type="button" onClick={() => void startTalking()} className="flex min-h-12 items-center rounded-full bg-surface-1/80 px-4 text-[14px] text-ink-soft hover:text-bone">
                {dictation.text ? 'Keep talking' : 'Talk instead'}
              </button>
            ) : <span />}
            <button type="button" onClick={() => void build()} className="btn btn-primary min-h-12 px-6">
              {copy.build} <span aria-hidden="true">→</span>
            </button>
          </div>
        )}

        {view === 'building' && <p className="min-h-12 text-[14px] text-ink-soft" aria-live="polite">{mode === 'profile' ? 'Building your vibe…' : 'Opening your trip…'}</p>}

        <p className="max-w-[60ch] text-center text-[11px] leading-snug text-ink-subtle">
          {voiceEnabled
            ? 'Your voice goes to OpenAI to be understood. dope.travel keeps nothing you say; changes happen on this device.'
            : `${usedSpeech && canTalk ? 'Your browser turns speech into text (Chrome uses Google’s speech service). ' : ''}${mode === 'profile'
              ? 'dope.travel gets the text only to sort it into your board and keeps none of it. The board, and what you said, are saved on this device.'
              : 'dope.travel reads the text to work out where you mean (and may ask a decision model), keeps none of it, and saves the trip on this device.'}`}
        </p>
      </div>
    </div>
  );
}

/** The sun button that opens the stage. */
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
      <SunGlyph size={20} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

/** The sunset mark: a golden-hour disc cut by two horizon bands, as in the logo. */
export function SunGlyph({ size = 20, glow = false }: { size?: number; glow?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-block shrink-0 overflow-hidden rounded-full ${glow ? 'sun-glyph-glow' : ''}`}
      style={{ width: size, height: size, background: 'linear-gradient(180deg,#f7c548 0%,#f26b2a 55%,#e4577e 100%)' }}
    >
      <span className="absolute inset-x-0 top-[62%] bg-[#1a0b06]" style={{ height: Math.max(1.5, size * 0.075) }} />
      <span className="absolute inset-x-0 top-[78%] bg-[#1a0b06]" style={{ height: Math.max(2, size * 0.1) }} />
    </span>
  );
}

/** The agenda: the essentials as bullets, the extras as chips; each lights up with what was locked for it. */
function TopicList({ items, live = false }: { items: ChecklistItem[]; live?: boolean }) {
  const core = items.filter((item) => item.core);
  const extra = items.filter((item) => !item.core);
  return (
    <div className={live ? '' : 'mt-2.5 sm:mt-3'}>
      <ul className={`flex flex-col ${live ? 'gap-1' : 'gap-2 sm:gap-3'}`} aria-label="Start with">
        {core.map((item) => (
          <li
            key={item.key}
            className={`flex items-start gap-3 rounded-[14px] transition-colors duration-300 ${live ? 'px-3 py-2' : ''} ${live && item.done ? 'bg-saffron/10' : ''}`}
          >
            <span
              aria-hidden="true"
              className={`mt-[7px] size-2 shrink-0 rotate-45 rounded-[2px] transition-colors duration-300 ${item.done ? 'bg-saffron shadow-[0_0_10px_rgba(247,197,72,0.8)]' : live ? 'bg-ink-faint' : 'bg-saffron'}`}
            />
            <span className={`min-w-0 leading-snug ${live ? 'text-[15px] sm:text-[17px]' : 'text-[15.5px] sm:text-[19px]'}`}>
              <strong className={`font-semibold ${item.done ? 'text-saffron' : 'text-bone'}`}>{item.label}</strong>
              {item.fact
                ? <span className="text-bone"> · {item.fact}</span>
                : <span className={live ? 'text-ink-muted' : 'text-ink-soft'}> · {item.hint}</span>}
              <span className="sr-only">{item.done ? ' (covered)' : ''}</span>
            </span>
          </li>
        ))}
      </ul>
      {extra.length > 0 && (
        <>
          <p className={`${live ? 'mt-2 px-3' : 'mt-4'} text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted`}>If you’ve got a minute</p>
          <ul className={`mt-1.5 flex flex-wrap gap-1.5 ${live ? 'px-3' : ''}`} aria-label="If you’ve got a minute">
            {extra.map((item) => (
              <li
                key={item.key}
                title={item.hint}
                className={`flex min-h-8 max-w-full items-center gap-1.5 rounded-full px-3 text-[13px] transition-colors duration-300 ${item.done ? 'bg-saffron/15 text-saffron' : 'bg-surface-1/80 text-ink-soft'}`}
              >
                <span aria-hidden="true">{item.done ? '✓' : '+'}</span>
                <span className="truncate">{item.fact ? `${item.label}: ${item.fact}` : item.label}</span>
                <span className="sr-only">{item.done ? ' (covered)' : `, ${item.hint}`}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
