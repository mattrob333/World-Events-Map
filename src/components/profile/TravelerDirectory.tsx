'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { PlatformShell } from '@/components/community/PlatformShell';
import { usePlatformAuth } from '@/lib/platform/usePlatformAuth';
import styles from './directory.module.css';

type DirectoryProfile = {
  id: string;
  handle: string;
  display_name: string;
  tagline: string;
  avatar_url: string;
  hero_url: string;
  theme_accent: string;
  home_city: string;
  home_airport: string;
  interests: string[];
  featured_modes: string[];
};

function isDirectoryProfile(value: unknown): value is DirectoryProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.handle === 'string' &&
    typeof row.display_name === 'string' &&
    Array.isArray(row.interests) &&
    Array.isArray(row.featured_modes)
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'M';
}

export function TravelerDirectory() {
  const { client } = usePlatformAuth();
  const [profiles, setProfiles] = useState<DirectoryProfile[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(Boolean(client));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!client) return;
    let active = true;
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      setLoading(true);
      setError('');
      const { data, error: failure } = await client.rpc('list_public_traveler_profiles', {
        p_limit: 80,
      });
      if (!active) return;
      if (failure) {
        setError(failure.message);
        setProfiles([]);
      } else {
        setProfiles(Array.isArray(data) ? data.filter(isDirectoryProfile) : []);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [client]);

  const shown = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return profiles;
    return profiles.filter((profile) => {
      const haystack = [
        profile.display_name,
        profile.handle,
        profile.tagline,
        profile.home_city,
        profile.home_airport,
        ...profile.interests,
        ...profile.featured_modes,
      ]
        .join(' ')
        .toLocaleLowerCase();
      return haystack.includes(needle);
    });
  }, [profiles, query]);

  return (
    <PlatformShell
      eyebrow="People graph · traveler identities"
      title="Find people worth traveling with."
      description="Profiles are the human layer of MERIDIAN. Search by person, home base, interest, or the way someone likes to travel, then open the full identity before you connect."
    >
      <section className={styles.toolbar}>
        <label>
          Search travelers
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ski families · Atlanta · Formula 1 · food"
          />
        </label>
        <div className={styles.count}>
          <strong>{shown.length}</strong>
          <span>public traveler{shown.length === 1 ? '' : 's'}</span>
        </div>
      </section>

      {!client ? (
        <section className={styles.state}>
          <h2>Member discovery is not connected yet.</h2>
          <p>Connect Supabase to load public traveler identities.</p>
        </section>
      ) : loading ? (
        <section className={styles.state}><span className={styles.loader} /><p>Mapping the traveler directory…</p></section>
      ) : error ? (
        <section className={styles.state}><h2>The directory could not load.</h2><p>{error}</p></section>
      ) : shown.length === 0 ? (
        <section className={styles.state}>
          <h2>{profiles.length ? 'No travelers match that search yet.' : 'The network starts with the first good profile.'}</h2>
          <p>{profiles.length ? 'Try a broader interest, city, or travel style.' : 'Public member profiles will appear here as people choose to publish them.'}</p>
        </section>
      ) : (
        <div className={styles.grid}>
          {shown.map((profile) => (
            <Link key={profile.id} href={`/people/${profile.handle}`} className={styles.card}>
              <div
                className={`${styles.hero} ${profile.hero_url ? styles.heroImage : ''}`}
                style={profile.hero_url ? { backgroundImage: `url(${profile.hero_url})` } : undefined}
              >
                <div className={styles.heroFade} />
              </div>
              <div className={styles.body}>
                <div className={styles.avatarWrap}>
                  {profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatar_url} alt="" className={styles.avatar} />
                  ) : (
                    <div className={styles.avatarFallback}>{initials(profile.display_name || profile.handle)}</div>
                  )}
                </div>
                <div className={styles.nameRow}>
                  <div>
                    <h2>{profile.display_name || profile.handle}</h2>
                    <span>@{profile.handle}</span>
                  </div>
                </div>
                {profile.tagline && <p className={styles.tagline}>{profile.tagline}</p>}
                <div className={styles.meta}>
                  {profile.home_city && <span>{profile.home_city}</span>}
                  {profile.home_airport && <span>{profile.home_airport}</span>}
                  {profile.featured_modes.slice(0, 2).map((mode) => <span key={mode}>{mode}</span>)}
                </div>
                {profile.interests.length > 0 && (
                  <div className={styles.chips}>
                    {profile.interests.slice(0, 5).map((interest) => <span key={interest}>{interest}</span>)}
                  </div>
                )}
                <div className={styles.open}>Open traveler profile <b>↗</b></div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </PlatformShell>
  );
}
