'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { bentoCards } from '@/lib/designer/moodboard';
import type { TravelerProfile } from '@/lib/designer/profile';
import { decodeProfile } from '@/lib/designer/share';
import { useDesignerStore } from '@/lib/designer/store';
import { BentoBoard } from './BentoBoard';
import styles from './designer.module.css';

function subscribeHash(callback: () => void) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

/** Opens a profile an AI agent prepared. The data lives in the link fragment and is only saved on this device. */
export function ProfileImport() {
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash, () => null);
  const fromLink = useMemo(() => (hash ? decodeProfile(new URLSearchParams(hash.slice(1)).get('p') ?? '') : null), [hash]);
  // Decoded once and kept: saving clears the fragment, and the page must not lose the profile when it does.
  const [kept, setKept] = useState<TravelerProfile | null>(null);
  const profile = kept ?? fromLink;
  const cards = useMemo(() => (profile ? bentoCards(profile) : []), [profile]);
  const saveProfile = useDesignerStore((state) => state.saveProfile);
  const [savedId, setSavedId] = useState<string | null>(null);
  const router = useRouter();

  function save(): string | null {
    if (!profile) return null;
    const id = savedId ?? `mb-${Date.now().toString(36)}`;
    saveProfile({ id, profile, engine: 'on-device', updatedAt: new Date().toISOString() });
    setKept(profile);
    setSavedId(id);
    // Drop the profile from the address bar and history once it is saved; a reload then says it was saved (retest N5).
    window.history.replaceState(null, '', '/moodboard/import#saved');
    return id;
  }

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>From your AI agent</p>
        {hash === null && !profile ? (
          <p className="py-16 text-ink-muted">Opening your profile…</p>
        ) : !profile && hash === '#saved' ? (
          <>
            <h1 className={styles.headline}>Saved on this device.</h1>
            <p className={styles.lede}>Your profile is in your Vibe profiles now. The link was cleared so it doesn’t sit in your history.</p>
            <Link href="/vibe" className={`${styles.cta} mt-6`}>
              Open my Vibe profile →
            </Link>
          </>
        ) : !profile ? (
          <>
            <h1 className={styles.headline}>This link has no profile in it.</h1>
            <p className={styles.lede}>It may have been cut off when it was copied. Ask your agent for the link again, or build your Vibe profile by talking.</p>
            <Link href="/vibe" className={`${styles.ghost} mt-6`}>
              Build it by talking
            </Link>
          </>
        ) : (
          <>
            <h1 className={styles.headline}>
              {savedId ? (
                <>
                  Saved. <span className={styles.accentText}>You’re on this device now.</span>
                </>
              ) : (
                <>
                  Here’s you, <span className={styles.accentText}>as your agent sees you.</span>
                </>
              )}
            </h1>
            <p className={styles.lede}>
              {savedId
                ? 'Your profile is saved on this device (and to your account if you turn that on in Settings). Plan a trip with it, or find it any time under Profiles on this device in Vibe profile.'
                : 'Check it over. Your AI built this link through dope.travel, which didn’t keep a copy; the profile rides in the link itself. Saving keeps it on this device (and in your account if you turn that on in Settings).'}
            </p>
            <div className={`${styles.row} mt-6`} aria-live="polite">
              {savedId ? (
                <>
                  <span className={styles.badge}>Saved ✓</span>
                  <button type="button" className={styles.cta} onClick={() => router.push(`/trips/designer?with=${savedId}`)}>
                    Plan a trip with it →
                  </button>
                  <Link href="/vibe#saved-title" className={styles.ghost}>
                    Find it in Vibe profile
                  </Link>
                </>
              ) : (
                <>
                  <button type="button" className={styles.cta} onClick={save}>
                    Save my profile
                  </button>
                  <button type="button" className={styles.ghost} onClick={() => router.push(`/trips/designer?with=${save()}`)}>
                    Save and plan a trip →
                  </button>
                </>
              )}
            </div>
            <div className="mt-6">
              <BentoBoard cards={cards} />
            </div>
            {!savedId ? (
              <p className={`${styles.hint} mt-4`}>
                Something off? Save it, then open it in <Link href="/vibe" className="underline">Vibe profile</Link> to fix names, ages and your crew.
              </p>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
