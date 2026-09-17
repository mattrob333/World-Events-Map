'use client';

import { useEffect, useMemo, useState } from 'react';
import { PlatformShell } from '@/components/community/PlatformShell';
import { getPlatformClient } from '@/lib/platform/client';
import {
  displayHost,
  youtubeVideoId,
  type PublicProfileContent,
  type ProfilePlaceKind,
  type TravelerSnapshot,
} from '@/lib/profile';
import styles from './profile.module.css';

const PLACE_LABEL: Record<ProfilePlaceKind, string> = {
  favorite: 'Favorites',
  visited: 'Been there',
  bucket: 'Next up',
};

export function PublicTravelerProfile({ handle }: { handle: string }) {
  const [client] = useState(getPlatformClient);
  const [snapshot, setSnapshot] = useState<TravelerSnapshot | null>(null);
  const [loading, setLoading] = useState(Boolean(client));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!client) return;
    let active = true;
    void client
      .rpc('traveler_snapshot', { profile_handle: handle })
      .then(({ data, error: failure }) => {
        if (!active) return;
        if (failure) {
          setError(failure.message);
          setLoading(false);
          return;
        }
        setSnapshot((data as TravelerSnapshot | null) ?? null);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client, handle]);

  const groupedPlaces = useMemo(() => {
    const groups: Record<ProfilePlaceKind, TravelerSnapshot['places']> = {
      favorite: [],
      visited: [],
      bucket: [],
    };
    for (const place of snapshot?.places ?? []) groups[place.kind].push(place);
    return groups;
  }, [snapshot]);

  if (!client) {
    return (
      <PlatformShell
        eyebrow="Traveler profile"
        title="Member services are not connected."
        description="Public traveler pages need the Supabase membership service."
      >
        <section className={styles.publicCard}>Configure membership services to load this profile.</section>
      </PlatformShell>
    );
  }

  if (loading) {
    return (
      <PlatformShell
        eyebrow="Traveler profile"
        title={`Finding @${handle}…`}
        description="Loading their places, travel modes and inspiration."
      >
        <section className={styles.publicCard}>Mapping this traveler’s world…</section>
      </PlatformShell>
    );
  }

  if (error || !snapshot) {
    return (
      <PlatformShell
        eyebrow="Traveler profile"
        title="This traveler page is not public."
        description="The handle may not exist yet, or the traveler has chosen to keep the profile private."
      >
        {error && <p className={styles.error}>{error}</p>}
      </PlatformShell>
    );
  }

  const profile = snapshot.profile;
  const initials =
    profile.display_name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'M';
  const visitedCount = groupedPlaces.visited.length;
  const bucketCount = groupedPlaces.bucket.length;

  return (
    <PlatformShell
      eyebrow="MERIDIAN traveler"
      title={`@${profile.handle}`}
      description="A living travel identity: where they have been, what pulls them out into the world, and the trips they want next."
    >
      <div className={`${styles.publicShell} ${styles[`theme_${profile.profile_theme}`] ?? ''}`}>
        <section className={`${styles.publicCard} ${styles.heroCard}`}>
          <div className={styles.cover}>
            {profile.cover_url && <img src={profile.cover_url} alt="" />}
          </div>
          <div className={styles.profileBody}>
            <div className={styles.avatar}>
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={`${profile.display_name} avatar`} />
              ) : (
                initials
              )}
            </div>
            <span className={styles.handle}>@{profile.handle}</span>
            <h1 className={styles.displayName}>{profile.display_name}</h1>
            {profile.headline && <p className={styles.headline}>{profile.headline}</p>}
            {(profile.home_city || profile.home_airport) && (
              <div className={styles.metaRow}>
                <span>{[profile.home_city, profile.home_airport].filter(Boolean).join(' · ')}</span>
              </div>
            )}
            <div className={styles.chips}>
              {profile.interests.map((interest) => (
                <span key={interest} className={styles.chip}>{interest}</span>
              ))}
            </div>
            {snapshot.links.length > 0 && (
              <div className={styles.actions}>
                {snapshot.links.map((link) => (
                  <a
                    key={link.id}
                    className={styles.secondaryButton}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {link.label} ↗
                  </a>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className={styles.stats} aria-label="Traveler profile stats">
          <div className={styles.stat}><strong>{visitedCount}</strong><span>places logged</span></div>
          <div className={styles.stat}><strong>{bucketCount}</strong><span>next-up places</span></div>
          <div className={styles.stat}><strong>{snapshot.modes.length}</strong><span>travel modes</span></div>
          <div className={styles.stat}><strong>{snapshot.content.length}</strong><span>wall pins</span></div>
        </section>

        {profile.bio && (
          <section className={styles.publicCard}>
            <span className={styles.eyebrow}>The traveler</span>
            <h2>How I like to move through the world.</h2>
            <p className={styles.muted}>{profile.bio}</p>
          </section>
        )}

        {snapshot.modes.length > 0 && (
          <section className={styles.publicCard}>
            <span className={styles.eyebrow}>Travel modes</span>
            <h2>Different trip. Different version of me.</h2>
            <div className={styles.modeGrid}>
              {snapshot.modes.map((mode) => (
                <article key={mode.id} className={styles.mode}>
                  <span className={styles.eyebrow}>{mode.party_type}</span>
                  <h3>{mode.name}</h3>
                  {mode.description && <p>{mode.description}</p>}
                  {(mode.origin_city || mode.origin_airport || mode.destination) && (
                    <p>
                      {[mode.origin_city || mode.origin_airport, mode.destination]
                        .filter(Boolean)
                        .join(' → ')}
                    </p>
                  )}
                  <div className={styles.chips}>
                    {mode.interests.slice(0, 6).map((interest) => (
                      <span className={styles.chip} key={interest.name}>{interest.name}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {snapshot.places.length > 0 && (
          <section className={styles.publicCard}>
            <span className={styles.eyebrow}>Places shelf</span>
            <h2>The map tells a story.</h2>
            {(Object.keys(PLACE_LABEL) as ProfilePlaceKind[]).map((kind) =>
              groupedPlaces[kind].length > 0 ? (
                <div key={kind}>
                  <p className={styles.eyebrow}>{PLACE_LABEL[kind]}</p>
                  <div className={styles.placeGrid}>
                    {groupedPlaces[kind].map((place) => (
                      <article key={place.id} className={styles.place}>
                        <h3>{place.place_name}</h3>
                        {place.country_code && <p>{place.country_code}</p>}
                        {place.note && <p>{place.note}</p>}
                      </article>
                    ))}
                  </div>
                </div>
              ) : null,
            )}
          </section>
        )}

        {snapshot.content.length > 0 && (
          <section className={styles.publicCard}>
            <span className={styles.eyebrow}>Travel wall</span>
            <h2>Things that make me want to pack a bag.</h2>
            <div className={styles.contentGrid}>
              {snapshot.content.map((item) => (
                <TravelContentCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        )}
      </div>
    </PlatformShell>
  );
}

function TravelContentCard({ item }: { item: PublicProfileContent }) {
  const youtubeId = item.provider === 'youtube' ? youtubeVideoId(item.url) : null;
  return (
    <article className={styles.content}>
      {youtubeId && (
        <iframe
          className={styles.video}
          src={`https://www.youtube.com/embed/${youtubeId}`}
          title={item.title || 'YouTube travel video'}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      )}
      {item.provider === 'image' && (
        <img className={styles.contentImage} src={item.url} alt={item.title || item.destination || 'Travel photo'} />
      )}
      <span className={styles.eyebrow}>{item.destination || item.provider}</span>
      <h3>{item.title || 'Travel inspiration'}</h3>
      {item.note && <p>{item.note}</p>}
      {!youtubeId && item.provider !== 'image' && (
        <a className={styles.secondaryButton} href={item.url} target="_blank" rel="noreferrer">
          Open on {displayHost(item.url)} ↗
        </a>
      )}
    </article>
  );
}
