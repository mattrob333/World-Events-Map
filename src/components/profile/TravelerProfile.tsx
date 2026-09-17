'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { PlatformShell } from '@/components/community/PlatformShell';
import { usePlatformAuth } from '@/lib/platform/usePlatformAuth';
import {
  isPublicTravelerProfile,
  type ProfileModule,
  type PublicTravelerProfile,
} from '@/lib/profile/types';
import styles from './profile.module.css';

const ACCENTS = {
  gold: '#d8b875',
  teal: '#59dfcc',
  ember: '#ff8a66',
  violet: '#b69cff',
  ice: '#8ed8ff',
  rose: '#ff93b6',
} as const;

type ConnectionRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'declined';
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'M';
}

function linkLabel(kind: string, label: string) {
  if (label.trim()) return label;
  if (kind === 'instagram') return 'Instagram';
  if (kind === 'youtube') return 'YouTube';
  if (kind === 'website') return 'Website';
  return 'Link';
}

function explain(cause: unknown) {
  if (cause instanceof Error) return cause.message;
  if (cause && typeof cause === 'object' && 'message' in cause) return String(cause.message);
  return 'Something went wrong. Please try again.';
}

function ModuleFrame({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.module}>
      <span className={styles.eyebrow}>{eyebrow}</span>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function TravelerProfile({ handle }: { handle: string }) {
  const { client, user } = usePlatformAuth();
  const [profile, setProfile] = useState<PublicTravelerProfile | null>(null);
  const [connection, setConnection] = useState<ConnectionRow | null>(null);
  const [loading, setLoading] = useState(Boolean(client));
  const [relationshipBusy, setRelationshipBusy] = useState(false);
  const [error, setError] = useState('');
  const [shareNotice, setShareNotice] = useState('');
  const [relationshipNotice, setRelationshipNotice] = useState('');

  useEffect(() => {
    if (!client) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    void client
      .rpc('get_public_traveler_profile', { p_handle: handle })
      .then(({ data, error: failure }) => {
        if (!active) return;
        if (failure) {
          setError(failure.message);
          setProfile(null);
        } else if (isPublicTravelerProfile(data)) {
          setProfile(data);
        } else {
          setProfile(null);
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client, handle]);

  const refreshConnection = useCallback(async () => {
    if (!client || !user || !profile || user.id === profile.id) {
      setConnection(null);
      return;
    }
    const { data, error: failure } = await client
      .from('profile_connections')
      .select('id,requester_id,addressee_id,status')
      .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`)
      .maybeSingle();
    if (failure) throw failure;
    setConnection((data as ConnectionRow | null) ?? null);
  }, [client, profile, user]);

  useEffect(() => {
    let active = true;
    void refreshConnection().catch((cause) => {
      if (active) setError(explain(cause));
    });
    return () => {
      active = false;
    };
  }, [refreshConnection]);

  const moduleOrder = useMemo<ProfileModule[]>(() => {
    if (!profile) return [];
    const allowed: ProfileModule[] = ['travel_modes', 'interests', 'places', 'links'];
    const configured = profile.module_order.filter((item): item is ProfileModule =>
      allowed.includes(item),
    );
    return configured.length ? configured : allowed;
  }, [profile]);

  if (!client) {
    return (
      <PlatformShell
        eyebrow="Traveler profile"
        title="Member profiles are not connected yet."
        description="Connect Supabase to load public MERIDIAN identities."
      >
        <section className={styles.stateCard}>
          <Link href="/" className={styles.primaryAction}>Back to Pulse</Link>
        </section>
      </PlatformShell>
    );
  }

  if (loading) {
    return (
      <PlatformShell
        eyebrow="Traveler profile"
        title="Reading this travel identity."
        description="Loading public profile context, featured travel modes, places, and links."
      >
        <section className={styles.stateCard}><span className={styles.loader} /></section>
      </PlatformShell>
    );
  }

  if (!profile) {
    return (
      <PlatformShell
        eyebrow="Traveler profile"
        title="This profile is not public."
        description="The handle may not exist, or this member has chosen not to publish a public identity."
      >
        <section className={styles.stateCard}>
          {error && <p className={styles.error}>{error}</p>}
          <Link href="/constellation" className={styles.primaryAction}>Open Constellation</Link>
        </section>
      </PlatformShell>
    );
  }

  const accent = ACCENTS[profile.theme_accent] ?? ACCENTS.gold;
  const themeStyle = { '--profile-accent': accent } as CSSProperties;
  const ownProfile = user?.id === profile.id;
  const inboundPending = Boolean(
    user && connection?.status === 'pending' && connection.addressee_id === user.id,
  );
  const outboundPending = Boolean(
    user && connection?.status === 'pending' && connection.requester_id === user.id,
  );

  async function shareProfile() {
    const url = window.location.href;
    setShareNotice('');
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${profile?.display_name || profile?.handle} on MERIDIAN`,
          text: profile?.tagline || 'See this traveler on MERIDIAN.',
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        setShareNotice('Profile link copied.');
      }
    } catch {
      // User cancellation is not an error state worth surfacing.
    }
  }

  async function requestConnection() {
    if (!client || !user || ownProfile) return;
    setRelationshipBusy(true);
    setRelationshipNotice('');
    setError('');
    try {
      const { error: failure } = await client.from('profile_connections').insert({
        requester_id: user.id,
        addressee_id: profile.id,
        status: 'pending',
      });
      if (failure) throw failure;
      setRelationshipNotice('Connection request sent.');
      await refreshConnection();
    } catch (cause) {
      setError(explain(cause));
    } finally {
      setRelationshipBusy(false);
    }
  }

  async function respondToConnection(status: 'accepted' | 'declined') {
    if (!client || !user || !connection || !inboundPending) return;
    setRelationshipBusy(true);
    setRelationshipNotice('');
    setError('');
    try {
      const { error: failure } = await client
        .from('profile_connections')
        .update({ status })
        .eq('id', connection.id)
        .eq('addressee_id', user.id);
      if (failure) throw failure;
      setRelationshipNotice(status === 'accepted' ? 'You are connected.' : 'Connection request declined.');
      await refreshConnection();
    } catch (cause) {
      setError(explain(cause));
    } finally {
      setRelationshipBusy(false);
    }
  }

  async function removeConnection() {
    if (!client || !user || !connection) return;
    setRelationshipBusy(true);
    setRelationshipNotice('');
    setError('');
    try {
      const { error: failure } = await client
        .from('profile_connections')
        .delete()
        .eq('id', connection.id);
      if (failure) throw failure;
      setRelationshipNotice('Connection removed.');
      await refreshConnection();
    } catch (cause) {
      setError(explain(cause));
    } finally {
      setRelationshipBusy(false);
    }
  }

  function renderModule(module: ProfileModule) {
    if (module === 'travel_modes') {
      if (!profile.travel_modes.length) return null;
      return (
        <ModuleFrame key={module} eyebrow="The versions of me" title="How I travel">
          <div className={styles.modeGrid}>
            {profile.travel_modes.map((mode) => (
              <article key={mode.id} className={styles.modeCard}>
                <div className={styles.modeTop}>
                  <strong>{mode.name}</strong>
                  <span>{mode.party_type}</span>
                </div>
                {mode.description && <p>{mode.description}</p>}
                {mode.destination && <p className={styles.destination}>Looking toward {mode.destination}</p>}
                {mode.interests.length > 0 && (
                  <div className={styles.chips}>
                    {mode.interests.slice(0, 8).map((interest) => (
                      <span key={interest.name}>{interest.name}</span>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </ModuleFrame>
      );
    }

    if (module === 'interests') {
      if (!profile.interests.length) return null;
      return (
        <ModuleFrame key={module} eyebrow="Common ground" title="Things I will always talk about">
          <div className={`${styles.chips} ${styles.largeChips}`}>
            {profile.interests.map((interest) => <span key={interest}>{interest}</span>)}
          </div>
        </ModuleFrame>
      );
    }

    if (module === 'places') {
      if (!profile.places.length) return null;
      return (
        <ModuleFrame key={module} eyebrow="Stamped into me" title="Places I stand behind">
          <div className={styles.placeGrid}>
            {profile.places.map((place) => (
              <article key={place.id} className={styles.placeCard}>
                <span>{place.place_type}</span>
                <h3>{place.name}</h3>
                {place.location_label && <strong>{place.location_label}</strong>}
                {place.note && <p>{place.note}</p>}
              </article>
            ))}
          </div>
        </ModuleFrame>
      );
    }

    if (module === 'links') {
      if (!profile.links.length) return null;
      return (
        <ModuleFrame key={module} eyebrow="Elsewhere" title="More of my world">
          <div className={styles.linkGrid}>
            {profile.links.map((link) => (
              <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className={styles.socialLink}>
                <span>{link.kind}</span>
                <strong>{linkLabel(link.kind, link.label)}</strong>
                <b>↗</b>
              </a>
            ))}
          </div>
        </ModuleFrame>
      );
    }

    return null;
  }

  return (
    <div className={`${styles.profileTheme} ${styles[profile.theme_variant]}`} style={themeStyle}>
      <PlatformShell
        eyebrow={`@${profile.handle}`}
        title={profile.display_name || profile.handle}
        description={profile.tagline || profile.bio || 'MERIDIAN traveler'}
      >
        <section className={styles.identityCard}>
          <div
            className={`${styles.cover} ${profile.hero_url ? styles.withCover : ''}`}
            style={profile.hero_url ? { backgroundImage: `url(${profile.hero_url})` } : undefined}
          >
            <div className={styles.coverGlow} />
          </div>
          <div className={styles.identityBody}>
            <div className={styles.avatarWrap}>
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt="" className={styles.avatar} />
              ) : (
                <div className={styles.avatarFallback}>{initials(profile.display_name || profile.handle)}</div>
              )}
            </div>
            <div className={styles.identityCopy}>
              <div className={styles.nameRow}>
                <div>
                  <h2>{profile.display_name || profile.handle}</h2>
                  <span>@{profile.handle}</span>
                </div>
                <div className={styles.actions}>
                  {ownProfile && <Link href="/account" className={styles.secondaryAction}>Edit profile</Link>}
                  {!ownProfile && user && !connection && (
                    <button type="button" className={styles.primaryAction} disabled={relationshipBusy} onClick={() => void requestConnection()}>
                      Connect
                    </button>
                  )}
                  {!ownProfile && user && outboundPending && (
                    <button type="button" className={styles.secondaryAction} disabled>Request sent</button>
                  )}
                  {!ownProfile && user && inboundPending && (
                    <>
                      <button type="button" className={styles.primaryAction} disabled={relationshipBusy} onClick={() => void respondToConnection('accepted')}>
                        Accept connection
                      </button>
                      <button type="button" className={styles.secondaryAction} disabled={relationshipBusy} onClick={() => void respondToConnection('declined')}>
                        Decline
                      </button>
                    </>
                  )}
                  {!ownProfile && user && connection?.status === 'accepted' && (
                    <button type="button" className={styles.secondaryAction} disabled={relationshipBusy} onClick={() => void removeConnection()}>
                      Connected · remove
                    </button>
                  )}
                  {!ownProfile && user && connection?.status === 'declined' && (
                    <button type="button" className={styles.secondaryAction} disabled={relationshipBusy} onClick={() => void removeConnection()}>
                      Clear request
                    </button>
                  )}
                  <button type="button" className={styles.secondaryAction} onClick={() => void shareProfile()}>
                    Share
                  </button>
                </div>
              </div>
              {profile.tagline && <p className={styles.tagline}>{profile.tagline}</p>}
              <div className={styles.metaRow}>
                {profile.home_city && <span>Home · {profile.home_city}</span>}
                {profile.home_airport && <span>Airport · {profile.home_airport}</span>}
                <span>{profile.travel_modes.length} featured mode{profile.travel_modes.length === 1 ? '' : 's'}</span>
                {connection?.status === 'accepted' && <span>Connected</span>}
              </div>
              {profile.bio && <p className={styles.bio}>{profile.bio}</p>}
              {shareNotice && <p className={styles.notice}>{shareNotice}</p>}
              {relationshipNotice && <p className={styles.notice}>{relationshipNotice}</p>}
              {error && <p className={styles.error}>{error}</p>}
            </div>
          </div>
        </section>

        <div className={styles.profileGrid}>
          <div className={styles.moduleStack}>{moduleOrder.map(renderModule)}</div>
          <aside className={styles.sideRail}>
            <section className={styles.contextCard}>
              <span className={styles.eyebrow}>Meet through context</span>
              <h2>Profiles are the person. Travel modes are the lens.</h2>
              <p>
                MERIDIAN never assumes one profile describes every trip. Open Constellation to see where your active travel mode overlaps this member and other travelers.
              </p>
              <Link href="/constellation" className={styles.primaryAction}>Find shared ground</Link>
            </section>
            <section className={styles.contextCard}>
              <span className={styles.eyebrow}>Public by choice</span>
              <p>
                This page only includes information the member published. Private travel modes, private Circle details, email, and precise live location are not profile content.
              </p>
            </section>
          </aside>
        </div>
      </PlatformShell>
    </div>
  );
}
