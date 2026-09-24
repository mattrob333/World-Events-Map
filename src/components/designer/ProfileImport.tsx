'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { bentoCards } from '@/lib/designer/moodboard';
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
  const profile = useMemo(() => (hash ? decodeProfile(new URLSearchParams(hash.slice(1)).get('p') ?? '') : null), [hash]);
  const saveProfile = useDesignerStore((state) => state.saveProfile);
  const [savedId, setSavedId] = useState<string | null>(null);
  const router = useRouter();

  function save() {
    if (!profile) return null;
    const id = savedId ?? `mb-${Date.now().toString(36)}`;
    saveProfile({ id, profile, engine: 'on-device', updatedAt: new Date().toISOString() });
    setSavedId(id);
    // Drop the profile from the address bar and history once it is saved.
    window.history.replaceState(null, '', '/moodboard/import');
    return id;
  }

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>From your AI agent</p>
        {hash === null ? (
          <p className="py-16 text-ink-muted">Opening your profile…</p>
        ) : !profile && !savedId ? (
          <>
            <h1 className={styles.headline}>This link has no profile in it.</h1>
            <p className={styles.lede}>It may have been cut off when it was copied. Ask your agent for the link again, or build your board by talking.</p>
            <Link href="/moodboard" className={`${styles.ghost} mt-6`}>
              Build it by talking
            </Link>
          </>
        ) : profile ? (
          <>
            <h1 className={styles.headline}>
              Here’s you, <span className={styles.gradientText}>as your agent sees you.</span>
            </h1>
            <p className={styles.lede}>
              Check it over. Saving keeps it on this device only; dope.travel never received this profile, because it traveled in the link itself.
            </p>
            <BentoBoard cards={bentoCards(profile)} />
            <div className={`${styles.row} mt-6`}>
              <button type="button" className={styles.cta} onClick={save}>
                {savedId ? '✓ Saved on this device' : 'Save my profile'}
              </button>
              <button type="button" className={styles.ghost} onClick={() => router.push(`/trips/designer?with=${save()}`)}>
                Plan a trip with it →
              </button>
              <Link href="/moodboard" className={styles.ghost}>
                Edit by talking
              </Link>
            </div>
          </>
        ) : (
          <h1 className={styles.headline}>Saved. Your profile is on this device.</h1>
        )}
      </div>
    </main>
  );
}
