'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EXAMPLE_RAMBLE, bentoCards, hasBoardContent } from '@/lib/designer/moodboard';
import {
  MAX_RAMBLE_CHARS,
  emptyProfile,
  parseProfileLocally,
  summarize,
  type ParseEngine,
  type TravelerProfile,
} from '@/lib/designer/profile';
import { tasteFrom } from '@/lib/designer/scene';
import { useDesignerStore } from '@/lib/designer/store';
import { BentoBoard } from './BentoBoard';
import styles from './designer.module.css';
import { LiveShows } from './LiveShows';
import { ScenePlaybook, usePersona } from './ScenePlaybook';
import { SpotifyPanel } from './SpotifyPanel';
import { TripIdeas } from './TripIdeas';
import { useHydrated } from './useHydrated';
import { useDictation } from './useDictation';

type Result = { profile: TravelerProfile; engine: ParseEngine; notice?: string };

const FACT_GROUPS: { key: keyof TravelerProfile; title: string }[] = [
  { key: 'teams', title: 'Teams' },
  { key: 'music', title: 'Music' },
  { key: 'events', title: 'Concerts & festivals' },
  { key: 'favoriteTrips', title: 'Favorite trips' },
  { key: 'interests', title: 'Into' },
  { key: 'food', title: 'Food' },
  { key: 'heritage', title: 'Roots' },
];

function removeFact(profile: TravelerProfile, key: keyof TravelerProfile, value: string): TravelerProfile {
  const list = profile[key];
  if (!Array.isArray(list)) return profile;
  const next = { ...profile, [key]: (list as string[]).filter((item) => item !== value) };
  return { ...next, summary: profile.summary };
}

export function MoodboardStudio({ spotifyJustConnected = false }: { spotifyJustConnected?: boolean }) {
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
  const board = result?.profile.listening;
  const persona = usePersona(hasTaste ? taste : null, {
    listeningHours: board?.nightOwl !== undefined ? `${Math.round(board.nightOwl * 100)}% of plays after 10 pm` : undefined,
    playlistHabits: board?.playlistHints,
  });

  const withListening = useCallback(
    (profile: TravelerProfile, engine: ParseEngine = 'on-device'): TravelerProfile => {
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
    window.history.replaceState(null, '', '/moodboard');
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
        <p className={styles.eyebrow}>Mood board · step 1 of 2</p>
        <h1 className={styles.headline}>
          Tell us about you. <span className={styles.accentText}>We’ll make the board.</span>
        </h1>
        <p className={styles.lede}>
          Ramble like you would to a friend: where you’re from, your teams, what’s on your playlist, the concerts you never miss,
          who you travel with, and the trips you still talk about. We sort it into a board that plans trips with you.
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
                {busy ? 'Sorting…' : 'Build my mood board'}
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
              sort it, is not stored on our servers, and the board is saved on this device only.
            </p>
          </div>
        </section>

        {mounted ? (
          <SpotifyPanel
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
              <h2 id="board-title" className="font-display text-[28px] text-ink">
                Your board
              </h2>
              <span className={`${styles.badge} ${result.engine === 'claude' ? styles.badgeAi : ''}`}>
                {result.engine === 'claude' ? 'Sorted by Claude' : 'Sorted on this device'}
              </span>
              <span className={styles.badge}>Mood imagery · not your photos</span>
              {result.profile.listening ? <span className={styles.badge}>+ Spotify</span> : null}
            </div>
            {result.profile.summary ? <p className={styles.lede}>{result.profile.summary}</p> : null}
            {result.notice ? <p className={styles.notice}>{result.notice}</p> : null}

            {hasBoardContent(result.profile) ? (
              <BentoBoard cards={cards} />
            ) : (
              <p className={styles.notice}>
                We couldn’t pick out much from that. Mention your hometown, teams, music, family, and favorite trips.
              </p>
            )}

            <div className={styles.facts}>
              {result.profile.family.length ? (
                <div className={styles.factGroup}>
                  <p className={styles.factTitle}>Travels with</p>
                  <div className={styles.chips}>
                    {result.profile.family.map((member, i) => (
                      <span key={i} className={styles.chip}>
                        {member.name ? `${member.name} · ` : ''}
                        {member.label}
                        {member.age !== undefined ? ` · ${member.age}` : ''}
                        {member.note ? ` · ${member.note}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {FACT_GROUPS.map(({ key, title }) => {
                const values = result.profile[key] as string[];
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

            {result.profile.listening?.topArtists.length || result.profile.teams.length ? (
              <TripIdeas
                artists={result.profile.listening?.topArtists.slice(0, 5) ?? []}
                teams={result.profile.teams.slice(0, 4)}
                homeCity={result.profile.hometown}
              />
            ) : null}

            {result.profile.listening?.topArtists.length ? (
              <LiveShows artists={result.profile.listening.topArtists.slice(0, 5)} hometown={result.profile.hometown} taste={taste ?? undefined} />
            ) : null}

            <div className={`${styles.row} mt-6`}>
              <button type="button" className={styles.cta} onClick={save}>
                {saved ? '✓ Saved on this device' : 'Save my board'}
              </button>
              <button type="button" className={styles.ghost} onClick={() => router.push(`/trips/designer?with=${save()}`)}>
                Plan a trip with this board →
              </button>
            </div>
          </section>
        ) : null}

        {mounted && profiles.length ? (
          <section className="mt-12" aria-labelledby="saved-title">
            <h2 id="saved-title" className={styles.eyebrow}>
              Boards on this device
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
                      <p className="truncate text-[14px] text-ink">{entry.profile.name ?? entry.profile.hometown ?? 'My board'}</p>
                      <p className="truncate text-[12px] text-ink-subtle">{entry.profile.summary || 'Saved board'}</p>
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
                      aria-label="Delete this board from the device"
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
