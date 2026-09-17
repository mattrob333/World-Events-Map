'use client';

import { usePlatformAuth } from '@/lib/platform/usePlatformAuth';
import {
  PlatformShell,
  SignInCard,
} from '@/components/community/PlatformShell';
import { ProfileIdentityEditor } from '@/components/profile/ProfileIdentityEditor';
import styles from '@/components/community/community.module.css';
import { SavedEvents } from './SavedEvents';
import { TravelModesEditor } from './TravelModesEditor';

export function Account({ initialEvent = '' }: { initialEvent?: string }) {
  const { user } = usePlatformAuth();
  return (
    <AccountContent key={user?.id ?? 'visitor'} initialEvent={initialEvent} />
  );
}

function AccountContent({ initialEvent }: { initialEvent: string }) {
  const { user } = usePlatformAuth();

  return (
    <PlatformShell
      eyebrow="Your identity on MERIDIAN"
      title="Make the profile people remember."
      description="Your profile is the person other travelers meet. Travel Modes are the different versions of you that show up for different kinds of trips."
    >
      <div className={styles.stack}>
        <SignInCard />
        {user && <ProfileIdentityEditor />}

        {user && (
          <section className={styles.card}>
            <span className={styles.eyebrow}>Profile vs. trip context</span>
            <h2>One person. Different versions of the trip.</h2>
            <p className={styles.muted}>
              Your public profile should feel stable and personal: who you are, what you love, where you feel at home, and the travel stories that say something about you. Travel Modes stay separate because Family Ski, Solo Weekend, and Work Layover should not expose the same intent or match the same people.
            </p>
            <p className={styles.muted}>
              A Travel Mode only appears on your public profile when you explicitly make it discoverable and feature it. Private modes, private Circle details, email, and precise live location stay out of the public identity layer.
            </p>
            <div className={styles.row}>
              <a href="/constellation" className={styles.button}>
                Open Constellation
              </a>
              <a href="/community" className={`${styles.button} ${styles.secondary}`}>
                Explore travel circles
              </a>
            </div>
          </section>
        )}

        <TravelModesEditor />
        <SavedEvents initialEvent={initialEvent} />
      </div>
    </PlatformShell>
  );
}
