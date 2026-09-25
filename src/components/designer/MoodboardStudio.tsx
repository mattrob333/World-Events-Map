'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EXAMPLE_RAMBLE, bentoCards, hasBoardContent } from '@/lib/designer/moodboard';
import {
  MAX_RAMBLE_CHARS,
  emptyProfile,
  normalizeProfile,
  parseProfileLocally,
  profileArtists,
  summarize,
  type FamilyMember,
  type ParseEngine,
  type Relation,
  type TravelerProfile,
  type VoiceStyle,
  withVoiceStyle,
} from '@/lib/designer/profile';
import { tasteFrom } from '@/lib/designer/scene';
import { useDesignerStore } from '@/lib/designer/store';
import { useVoicePage } from '@/lib/voice/registry';
import { BentoBoard } from './BentoBoard';
import styles from './designer.module.css';
import { LiveShows } from './LiveShows';
import { ScenePlaybook, usePersona } from './ScenePlaybook';
import { SpotifyPanel, type SpotifyCapabilities } from './SpotifyPanel';
import { TripIdeas } from './TripIdeas';
import { useHydrated } from './useHydrated';
import { useDictation } from './useDictation';
import { SourceLogo } from '@/components/brand/SourceLogo';

type Result = { profile: TravelerProfile; engine: ParseEngine; notice?: string };

const FACT_GROUPS: { key: keyof TravelerProfile; title: string }[] = [
  { key: 'teams', title: 'Teams' },
  { key: 'artists', title: 'Artists' },
  { key: 'music', title: 'Music' },
  { key: 'events', title: 'Concerts & festivals' },
  { key: 'favoriteTrips', title: 'Favorite trips' },
  { key: 'interests', title: 'Into' },
  { key: 'food', title: 'Food' },
  { key: 'heritage', title: 'Roots' },
];

/**
 * The built board, kept for this tab until it's saved, so a reload doesn't
 * lose it (UFR2-F16). Session storage: it clears when the tab closes, and
 * saved boards live in the device store.
 */
const DRAFT_BOARD_KEY = 'meridian.designer.draftBoard.v1';

type DraftBoard = { result: Result; boardId: string | null; saved: boolean };

function readDraftBoard(): DraftBoard | null {
  try {
    const raw = JSON.parse(window.sessionStorage.getItem(DRAFT_BOARD_KEY) ?? 'null') as Partial<DraftBoard> & { result?: Partial<Result> } | null;
    if (!raw?.result?.profile) return null;
    return {
      result: {
        profile: normalizeProfile(raw.result.profile),
        engine: raw.result.engine === 'claude' ? 'claude' : 'on-device',
        notice: typeof raw.result.notice === 'string' ? raw.result.notice.slice(0, 300) : undefined,
      },
      boardId: typeof raw.boardId === 'string' && /^mb-[a-z0-9]{1,20}$/.test(raw.boardId) ? raw.boardId : null,
      saved: raw.saved === true,
    };
  } catch {
    return null;
  }
}

function writeDraftBoard(draft: DraftBoard | null) {
  try {
    if (draft) window.sessionStorage.setItem(DRAFT_BOARD_KEY, JSON.stringify(draft));
    else window.sessionStorage.removeItem(DRAFT_BOARD_KEY);
  } catch {
    // Blocked or full storage: the board still works for this visit.
  }
}

const CREW_OPTIONS: { label: string; relation: Relation }[] = [
  { label: 'Wife', relation: 'partner' }, { label: 'Husband', relation: 'partner' }, { label: 'Partner', relation: 'partner' },
  { label: 'Son', relation: 'child' }, { label: 'Daughter', relation: 'child' }, { label: 'Kid', relation: 'child' },
  { label: 'Friend', relation: 'friend' }, { label: 'Mom', relation: 'parent' }, { label: 'Dad', relation: 'parent' },
  { label: 'Brother', relation: 'sibling' }, { label: 'Sister', relation: 'sibling' },
];

function memberText(member: FamilyMember): string {
  return [member.name, member.label, member.age !== undefined ? String(member.age) : '', member.note].filter(Boolean).join(' · ');
}

/** "Did we get you right?": name, age, home city and crew, all editable (UFR2-F01, F02, F16). */
function IdentityStrip({ profile, onChange }: { profile: TravelerProfile; onChange: (patch: Partial<TravelerProfile>) => void }) {
  // What's typed while an age is half-entered ("4" on the way to "44"); otherwise the profile's age shows.
  const [ageText, setAgeText] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [crewName, setCrewName] = useState('');
  const [crewLabel, setCrewLabel] = useState('Kid');
  const [crewAge, setCrewAge] = useState('');

  function addMember() {
    const option = CREW_OPTIONS.find((o) => o.label === crewLabel) ?? CREW_OPTIONS[5];
    const parsed = crewAge.trim() ? Number(crewAge) : undefined;
    const member: FamilyMember = {
      relation: option.relation,
      label: option.label,
      name: crewName.trim().slice(0, 40) || undefined,
      age: parsed !== undefined && Number.isInteger(parsed) && parsed >= 0 && parsed <= 110 ? parsed : undefined,
    };
    onChange({ family: [...profile.family, member].slice(0, 12) });
    setCrewName('');
    setCrewAge('');
    setAdding(false);
  }

  const guessed = profile.family.some((member) => member.guessed);
  return (
    <section className={`${styles.factGroup} mt-6`} aria-labelledby="identity-title">
      <p id="identity-title" className={styles.factTitle}>
        Did we get you right?
      </p>
      <p className={`${styles.hint} mt-1`}>Fix anything we misheard. Trips use your home city for fares and your crew for rooms and picks.</p>
      <div className="mt-3 grid grid-cols-[1fr_88px] gap-3 sm:grid-cols-[1fr_96px_1.4fr]">
        <label className={styles.label}>
          Name
          <input
            className={styles.input}
            value={profile.name ?? ''}
            maxLength={40}
            autoComplete="given-name"
            placeholder="First name"
            onChange={(e) => onChange({ name: e.target.value.slice(0, 40) || undefined })}
          />
        </label>
        <label className={styles.label}>
          Age
          <input
            className={styles.input}
            value={ageText ?? (profile.age !== undefined ? String(profile.age) : '')}
            inputMode="numeric"
            maxLength={3}
            placeholder="—"
            onBlur={() => setAgeText(null)}
            onChange={(e) => {
              const next = e.target.value.replace(/\D/g, '').slice(0, 3);
              setAgeText(next);
              const n = Number(next);
              onChange({ age: next && n >= 13 && n <= 110 ? n : undefined });
            }}
          />
        </label>
        <label className={`${styles.label} col-span-2 sm:col-span-1`}>
          Home city
          <input
            className={styles.input}
            value={profile.hometown ?? ''}
            maxLength={80}
            autoComplete="address-level2"
            placeholder="Your home city (for fares)"
            onChange={(e) => onChange({ hometown: e.target.value.slice(0, 80) || undefined })}
          />
        </label>
      </div>
      <p className={`${styles.factTitle} mt-4`}>Travels with</p>
      <div className={styles.chips}>
        {profile.family.map((member, i) => (
          <span key={`${member.label}-${member.name ?? ''}-${i}`} className={styles.chip} style={member.guessed ? { borderStyle: 'dashed', opacity: 0.8 } : undefined}>
            {memberText(member)}
            {member.guessed ? <span className="text-ink-subtle"> · guessed</span> : null}
            <button
              type="button"
              className={styles.chipX}
              onClick={() => onChange({ family: profile.family.filter((_, j) => j !== i) })}
              aria-label={`Remove ${memberText(member)}`}
            >
              ×
            </button>
          </span>
        ))}
        {!adding ? (
          <button type="button" className={styles.miniBtn} style={{ minHeight: 44 }} onClick={() => setAdding(true)}>
            + add
          </button>
        ) : null}
      </div>
      {guessed ? <p className={`${styles.hint} mt-2`}>Dashed chips are a guess from “the kids”; remove any that aren’t real, or add them with ages.</p> : null}
      {adding ? (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className={styles.label}>
            Who
            <select className={styles.input} value={crewLabel} onChange={(e) => setCrewLabel(e.target.value)} style={{ minHeight: 44 }}>
              {CREW_OPTIONS.map((o) => (
                <option key={o.label}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className={styles.label}>
            Name
            <input className={styles.input} value={crewName} maxLength={40} placeholder="Optional" onChange={(e) => setCrewName(e.target.value)} />
          </label>
          <label className={styles.label} style={{ width: 80 }}>
            Age
            <input className={styles.input} value={crewAge} inputMode="numeric" maxLength={3} placeholder="—" onChange={(e) => setCrewAge(e.target.value.replace(/\D/g, ''))} />
          </label>
          <button type="button" className={styles.miniBtn} style={{ minHeight: 44 }} onClick={addMember}>
            Add
          </button>
          <button type="button" className={styles.miniBtn} style={{ minHeight: 44 }} onClick={() => setAdding(false)}>
            Cancel
          </button>
        </div>
      ) : null}
    </section>
  );
}

function removeFact(profile: TravelerProfile, key: keyof TravelerProfile, value: string): TravelerProfile {
  const list = profile[key];
  if (!Array.isArray(list)) return profile;
  const next = { ...profile, [key]: (list as string[]).filter((item) => item !== value) };
  return { ...next, summary: profile.summary };
}

const NO_SPOTIFY: SpotifyCapabilities = { spotifyPlaylist: false, spotifySignIn: false };

export function MoodboardStudio({
  spotifyJustConnected = false,
  capabilities = NO_SPOTIFY,
}: {
  spotifyJustConnected?: boolean;
  capabilities?: SpotifyCapabilities;
}) {
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [boardId, setBoardId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const mounted = useHydrated();
  const profiles = useDesignerStore((state) => state.profiles);
  const saveProfile = useDesignerStore((state) => state.saveProfile);
  const removeProfile = useDesignerStore((state) => state.removeProfile);
  // The draft lives in the device store so it survives the Spotify sign-in redirect.
  const draftRamble = useDesignerStore((state) => state.draftRamble);
  const setDraftRamble = useDesignerStore((state) => state.setDraftRamble);
  const listeningData = useDesignerStore((state) => state.draftListening);
  const setDraftListening = useDesignerStore((state) => state.setDraftListening);
  const text = mounted ? draftRamble : '';
  const spotify = mounted ? listeningData : null;

  const router = useRouter();

  // Bring back a board built in this tab but not saved yet; then keep it in step as it changes.
  const restored = useRef(false);
  useEffect(() => {
    if (!mounted || restored.current) return;
    restored.current = true;
    if (result || spotifyJustConnected) return;
    const draft = readDraftBoard();
    if (!draft) return;
    // One-time restore from session storage after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResult(draft.result);
    setBoardId(draft.boardId);
    setSaved(draft.saved);
  }, [mounted, result, spotifyJustConnected]);
  useEffect(() => {
    if (!restored.current) return;
    writeDraftBoard(result ? { result, boardId, saved } : null);
  }, [result, boardId, saved]);

  const append = useCallback((chunk: string) => {
    if (!chunk) return;
    const current = useDesignerStore.getState().draftRamble;
    setDraftRamble(`${current}${current && !/\s$/.test(current) ? ' ' : ''}${chunk}`.slice(0, MAX_RAMBLE_CHARS));
  }, [setDraftRamble]);
  const setText = setDraftRamble;
  const dictation = useDictation(append);
  const listening = dictation.status === 'listening';

  const cards = useMemo(() => (result ? bentoCards(result.profile) : []), [result]);
  const taste = useMemo(() => (result ? tasteFrom(result.profile) : null), [result]);
  const hasTaste = Boolean(taste && (taste.genres.length || taste.topArtists?.length));
  const artists = useMemo(() => (result ? profileArtists(result.profile) : []), [result]);
  const board = result?.profile.listening;
  const persona = usePersona(hasTaste ? taste : null, {
    listeningHours: board?.nightOwl !== undefined ? `${Math.round(board.nightOwl * 100)}% of plays after 10 pm` : undefined,
    playlistHabits: board?.playlistHints,
  });

  // How they travel, as the voice concierge heard it (pace, budget, hard no's), applied to the next build.
  const voiceStyle = useRef<VoiceStyle | null>(null);
  const withListening = useCallback(
    (parsed: TravelerProfile, engine: ParseEngine = 'on-device'): TravelerProfile => {
      const profile = withVoiceStyle(parsed, voiceStyle.current);
      if (!spotify) return profile;
      const merged = { ...profile, listening: spotify };
      // Claude writes its own summary; the device summary is rebuilt to include the artists.
      return engine === 'claude' ? merged : { ...merged, summary: summarize(merged) };
    },
    [spotify],
  );

  async function build() {
    if (listening) dictation.stop();
    setError('');
    setSaved(false);
    setBoardId(null);
    if (text.trim().length < 10) {
      if (spotify) {
        // Spotify alone is enough for a board.
        setResult({ profile: withListening(emptyProfile()), engine: 'on-device' });
        return;
      }
      setError('Say or type a few sentences about yourself first, or connect Spotify.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/designer/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text }),
      });
      const body = (await response.json()) as Result & { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Could not sort that.');
      setResult({ profile: withListening(body.profile, body.engine), engine: body.engine, notice: body.notice });
    } catch (cause) {
      // The on-device parser is always available, so a network failure never strands the ramble.
      setResult({
        profile: withListening(parseProfileLocally(text)),
        engine: 'on-device',
        notice: cause instanceof Error && cause.message !== 'Failed to fetch' ? cause.message : 'Offline, so this was sorted on the device.',
      });
    } finally {
      setBusy(false);
    }
  }

  // Voice: the Sun listens, writes a first-person summary into the ramble, and builds the board.
  const buildRef = useRef(build);
  const saveRef = useRef(save);
  useEffect(() => {
    buildRef.current = build;
    saveRef.current = save;
  });
  useVoicePage(
    'board',
    {
      describe_me: async (args) => {
        const summary = typeof args.summary === 'string' ? args.summary.trim().slice(0, MAX_RAMBLE_CHARS) : '';
        if (summary.length < 10) return 'Error: I need a few sentences first.';
        voiceStyle.current = { pace: args.pace, budget: args.budget, avoid: args.avoid, splurge: args.splurge };
        setText(summary);
        await new Promise((resolve) => window.setTimeout(resolve, 60));
        await buildRef.current();
        // They asked for their vibe, so it's saved on this device and shown, not left below the form.
        await new Promise((resolve) => window.setTimeout(resolve, 60));
        const saved = saveRef.current();
        document.getElementById('board-title')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        document.getElementById('board-title')?.focus({ preventScroll: true });
        return saved ? 'Built and saved their Vibe profile on this device; it is on screen now. Ask if anything looks wrong.' : 'Built their Vibe profile; it is on screen now. Ask if anything looks wrong.';
      },
    },
    () => (result ? 'Their Vibe profile is on screen.' : text.trim() ? `They have started typing about themselves: "${text.trim().slice(0, 200)}"` : 'An empty Vibe profile, waiting for them to describe themselves.'),
    (typed) => {
      setText([text.trim(), typed].filter(Boolean).join(' '));
      return 'Added that to your description. Keep going, then tap Build my Vibe profile.';
    },
  );

  // A playlist link read without sign-in lands here; build the board once it is in the store.
  const buildOnImport = useRef(false);
  useEffect(() => {
    if (!buildOnImport.current || !spotify) return;
    buildOnImport.current = false;
    void build();
    // build reads the latest listening; it only needs to run when that arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotify]);

  const autoBuilt = useRef(false);
  useEffect(() => {
    if (!spotifyJustConnected || !mounted || !spotify || autoBuilt.current) return;
    autoBuilt.current = true;
    window.history.replaceState(null, '', '/vibe');
    void build();
    // Runs once when Spotify hands control back; build reads the latest draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotifyJustConnected, mounted, spotify]);

  function save(): string | undefined {
    if (!result) return undefined;
    const id = boardId ?? `mb-${Date.now().toString(36)}`;
    saveProfile({ id, profile: result.profile, engine: result.engine, updatedAt: new Date().toISOString() });
    setBoardId(id);
    setSaved(true);
    return id;
  }

  function edit(key: keyof TravelerProfile, value: string) {
    if (!result) return;
    const profile = removeFact(result.profile, key, value);
    setResult({ ...result, profile: { ...profile, summary: result.engine === 'claude' ? profile.summary : summarize(profile) } });
    setSaved(false);
  }

  /** Identity and crew edits. A board that's already saved is updated in place, so the designer sees the fix. */
  function correct(patch: Partial<TravelerProfile>) {
    if (!result) return;
    const next = { ...result.profile, ...patch };
    if (patch.family) next.family = patch.family.map((member) => ({ ...member }));
    const profile = { ...next, summary: summarize(next) || next.summary };
    setResult({ ...result, profile });
    if (boardId) {
      saveProfile({ id: boardId, profile, engine: result.engine, updatedAt: new Date().toISOString() });
      setSaved(true);
    } else {
      setSaved(false);
    }
  }

  const micLabel =
    dictation.status === 'unsupported'
      ? 'Voice input is not available in this browser. Type instead, or use your keyboard’s dictation.'
      : dictation.status === 'denied'
        ? 'Microphone access was blocked. Allow it in the browser, or type instead.'
        : dictation.status === 'error'
          ? 'Voice input stopped. Tap the mic to try again.'
          : listening
            ? 'Listening… ramble away. Tap again to stop.'
            : 'Tap the mic and just talk.';

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>Vibe profile · step 1 of 2</p>
        <h1 className={styles.headline}>
          Tell us about you. <span className={styles.accentText}>We’ll learn your vibe.</span>
        </h1>
        <p className={styles.lede}>
          Ramble like you would to a friend: where you’re from, your teams, what’s on your playlist, the concerts you never miss,
          who you travel with, and the trips you still talk about. We sort it into a Vibe profile that plans trips with you.
        </p>

        <section className={styles.recorder} aria-label="Your ramble">
          <div className="grid justify-items-center gap-2">
            <button
              type="button"
              className={`${styles.mic} ${listening ? styles.micLive : ''}`}
              onClick={() => (listening ? dictation.stop() : dictation.start())}
              disabled={dictation.status === 'unsupported'}
              aria-pressed={listening}
              aria-label={listening ? 'Stop listening' : 'Start talking'}
            >
              <svg className={styles.micIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                {listening ? (
                  <rect x="7" y="7" width="10" height="10" rx="2.5" fill="currentColor" stroke="none" />
                ) : (
                  <>
                    <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" stroke="none" />
                    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
                  </>
                )}
              </svg>
            </button>
          </div>
          <div className="grid w-full gap-3">
            <p className="text-[13px] text-ink-muted" aria-live="polite">
              {micLabel}
            </p>
            <label className={styles.srOnly} htmlFor="ramble">
              Your ramble
            </label>
            <textarea
              id="ramble"
              className={styles.transcript}
              value={text}
              maxLength={MAX_RAMBLE_CHARS}
              onChange={(event) => setText(event.target.value)}
              placeholder="I'm 44, from Atlanta. Braves fan. Two boys, 8 and 12…"
            />
            {dictation.interim ? <p className={styles.interim}>{dictation.interim}</p> : null}
            <div className={styles.row}>
              <button type="button" className={styles.cta} onClick={build} disabled={busy}>
                {busy ? 'Sorting…' : 'Build my Vibe profile'}
              </button>
              <button type="button" className={styles.ghost} onClick={() => setText(EXAMPLE_RAMBLE)}>
                Try an example
              </button>
              {text ? (
                <button type="button" className={styles.ghost} onClick={() => setText('')}>
                  Clear
                </button>
              ) : null}
            </div>
            {error ? <p className={styles.error} role="alert">{error}</p> : null}
            <p className={styles.hint}>
              Your browser turns speech into text (Chrome uses Google’s speech service). The text is sent to dope.travel only to
              sort it, is not stored on our servers, and your profile is saved on this device only.
            </p>
          </div>
        </section>

        {mounted ? (
          <SpotifyPanel
            capabilities={capabilities}
            listening={spotify}
            onImported={(imported) => {
              buildOnImport.current = true;
              setDraftListening(imported);
            }}
            onDisconnect={() => {
              setDraftListening(null);
              if (result?.profile.listening) setResult({ ...result, profile: { ...result.profile, listening: undefined } });
              setSaved(false);
            }}
          />
        ) : null}

        {result ? (
          <section className="mt-10" aria-labelledby="board-title">
            <div className={styles.row}>
              <h2 id="board-title" tabIndex={-1} className="font-display text-[28px] text-ink">
                Your Vibe profile
              </h2>
              <span className={`${styles.badge} ${result.engine === 'claude' ? styles.badgeAi : ''}`}>
                {result.engine === 'claude' ? 'Sorted by Claude' : 'Sorted by simple rules'}
              </span>
              <span className={styles.badge}>Editorial imagery · not your photos</span>
              {result.profile.listening ? <span className={styles.badge}><SourceLogo source="spotify" size={12} className="mr-1" />Spotify</span> : null}
            </div>
            {result.profile.summary ? <p className={styles.lede}>{result.profile.summary}</p> : null}
            {result.notice ? <p className={styles.notice}>{result.notice}</p> : null}

            <IdentityStrip profile={result.profile} onChange={correct} />

            {hasBoardContent(result.profile) ? (
              <BentoBoard cards={cards} />
            ) : (
              <p className={styles.notice}>
                We couldn’t pick out much from that. Mention your hometown, teams, music, family, and favorite trips.
              </p>
            )}

            <div className={styles.facts}>
              {FACT_GROUPS.map(({ key, title }) => {
                const values = (result.profile[key] as string[] | undefined) ?? [];
                if (!values.length) return null;
                return (
                  <div key={key} className={styles.factGroup}>
                    <p className={styles.factTitle}>{title}</p>
                    <div className={styles.chips}>
                      {values.map((value) => (
                        <span key={value} className={styles.chip}>
                          {value}
                          <button type="button" className={styles.chipX} onClick={() => edit(key, value)} aria-label={`Remove ${value}`}>
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {hasTaste && taste ? <ScenePlaybook taste={taste} persona={persona} /> : null}

            {artists.length || result.profile.teams.length ? (
              <TripIdeas
                artists={artists.slice(0, 5)}
                teams={result.profile.teams.slice(0, 4)}
                homeCity={result.profile.hometown}
              />
            ) : null}

            {artists.length ? (
              <LiveShows artists={artists.slice(0, 5)} hometown={result.profile.hometown} taste={taste ?? undefined} />
            ) : null}

            <div className={`${styles.row} mt-6`}>
              <button type="button" className={styles.cta} onClick={save}>
                {saved ? '✓ Saved on this device' : 'Save my profile'}
              </button>
              <button type="button" className={styles.ghost} onClick={() => router.push(`/trips/designer?with=${save()}`)}>
                Plan a trip with this profile →
              </button>
            </div>
          </section>
        ) : null}

        {mounted && profiles.length ? (
          <section className="mt-12" aria-labelledby="saved-title">
            <h2 id="saved-title" className={styles.eyebrow}>
              Profiles on this device
            </h2>
            <div className={styles.savedList}>
              {profiles.map((entry) => {
                const tile = bentoCards(entry.profile)[0];
                return (
                  <div key={entry.id} className={styles.savedCard}>
                    <span
                      className={styles.savedSwatch}
                      style={{ background: tile ? `linear-gradient(135deg, ${tile.palette[0]}, ${tile.palette[1]})` : 'var(--color-surface-3)' }}
                      aria-hidden
                    >
                      {tile?.emoji ?? '✨'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] text-ink">{entry.profile.name ?? entry.profile.hometown ?? 'My profile'}</p>
                      <p className="truncate text-[12px] text-ink-subtle">{entry.profile.summary || 'Saved profile'}</p>
                    </div>
                    <button
                      type="button"
                      className={styles.miniBtn}
                      onClick={() => {
                        setResult({ profile: entry.profile, engine: entry.engine });
                        setBoardId(entry.id);
                        setSaved(true);
                      }}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      className={styles.miniBtn}
                      onClick={() => removeProfile(entry.id)}
                      aria-label="Delete this profile from the device"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
