'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { usePlatformAuth } from '@/lib/platform/usePlatformAuth';
import type { ProfileAccent, ProfileThemeVariant } from '@/lib/profile/types';
import styles from '@/components/community/community.module.css';
import editorStyles from './profileEditor.module.css';

type LinkRow = {
  id: string;
  kind: 'instagram' | 'youtube' | 'website' | 'other';
  label: string;
  url: string;
  visibility: 'public' | 'private';
};

type PlaceRow = {
  id: string;
  name: string;
  place_type: 'city' | 'venue' | 'resort' | 'region' | 'other';
  location_label: string;
  note: string;
  visibility: 'public' | 'private';
};

const THEMES: Array<{ value: ProfileThemeVariant; label: string }> = [
  { value: 'midnight', label: 'Midnight' },
  { value: 'atlas', label: 'Atlas' },
  { value: 'alpine', label: 'Alpine' },
];

const ACCENTS: Array<{ value: ProfileAccent; label: string }> = [
  { value: 'gold', label: 'Gold' },
  { value: 'teal', label: 'Teal' },
  { value: 'ember', label: 'Ember' },
  { value: 'violet', label: 'Violet' },
  { value: 'ice', label: 'Ice' },
  { value: 'rose', label: 'Rose' },
];

function explain(cause: unknown) {
  if (cause instanceof Error) return cause.message;
  if (cause && typeof cause === 'object' && 'message' in cause) return String(cause.message);
  return 'Something went wrong. Please try again.';
}

export function ProfileIdentityEditor() {
  const { client, user } = usePlatformAuth();
  const [handle, setHandle] = useState('');
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [city, setCity] = useState('');
  const [homeAirport, setHomeAirport] = useState('');
  const [showCity, setShowCity] = useState(true);
  const [showAirport, setShowAirport] = useState(false);
  const [interests, setInterests] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [heroUrl, setHeroUrl] = useState('');
  const [theme, setTheme] = useState<ProfileThemeVariant>('midnight');
  const [accent, setAccent] = useState<ProfileAccent>('gold');
  const [visible, setVisible] = useState(false);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [places, setPlaces] = useState<PlaceRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    if (!client || !user) return;
    const [profileResult, linksResult, placesResult] = await Promise.all([
      client
        .from('profiles')
        .select('handle,display_name,tagline,home_city,home_airport,show_home_city,show_home_airport,interests,bio,avatar_url,hero_url,theme_variant,theme_accent,is_public')
        .eq('id', user.id)
        .maybeSingle(),
      client
        .from('profile_links')
        .select('id,kind,label,url,visibility,sort_order')
        .eq('profile_id', user.id)
        .order('sort_order'),
      client
        .from('profile_places')
        .select('id,name,place_type,location_label,note,visibility,sort_order')
        .eq('profile_id', user.id)
        .order('sort_order'),
    ]);

    const failure = profileResult.error || linksResult.error || placesResult.error;
    if (failure) throw failure;
    const data = profileResult.data;
    setHandle(data?.handle ?? '');
    setName(data?.display_name ?? '');
    setTagline(data?.tagline ?? '');
    setCity(data?.home_city ?? '');
    setHomeAirport(data?.home_airport ?? '');
    setShowCity(data?.show_home_city !== false);
    setShowAirport(data?.show_home_airport === true);
    setInterests((data?.interests ?? []).join(', '));
    setBio(data?.bio ?? '');
    setAvatarUrl(data?.avatar_url ?? '');
    setHeroUrl(data?.hero_url ?? '');
    setTheme((data?.theme_variant as ProfileThemeVariant) ?? 'midnight');
    setAccent((data?.theme_accent as ProfileAccent) ?? 'gold');
    setVisible(data?.is_public === true);
    setLinks((linksResult.data ?? []) as LinkRow[]);
    setPlaces((placesResult.data ?? []) as PlaceRow[]);
    setReady(true);
  }, [client, user]);

  useEffect(() => {
    if (!client || !user) return;
    let active = true;
    void refresh().catch((cause) => {
      if (active) setError(explain(cause));
    });
    return () => {
      active = false;
    };
  }, [client, user, refresh]);

  const cleanInterests = useMemo(
    () => [
      ...new Set(
        interests
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ].slice(0, 12),
    [interests],
  );

  if (!user) return null;

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!client || !user) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { error: failure } = await client
        .from('profiles')
        .update({
          handle: handle.trim() || null,
          display_name: name.trim(),
          tagline: tagline.trim(),
          home_city: city.trim(),
          home_airport: homeAirport.trim().toUpperCase(),
          show_home_city: showCity,
          show_home_airport: showAirport,
          interests: cleanInterests,
          bio: bio.trim(),
          avatar_url: avatarUrl.trim(),
          hero_url: heroUrl.trim(),
          theme_variant: theme,
          theme_accent: accent,
          is_public: visible,
        })
        .eq('id', user.id);
      if (failure) throw failure;
      setNotice(
        visible && handle.trim()
          ? 'Profile saved and ready to share.'
          : 'Profile saved. Publish it and choose a handle when you are ready to share.',
      );
      await refresh();
    } catch (cause) {
      setError(explain(cause));
    } finally {
      setBusy(false);
    }
  }

  async function addLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || !user) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError('');
    try {
      const { error: failure } = await client.from('profile_links').insert({
        profile_id: user.id,
        kind: String(data.get('kind')),
        label: String(data.get('label')).trim(),
        url: String(data.get('url')).trim(),
        visibility: data.get('visibility') === 'private' ? 'private' : 'public',
        sort_order: links.length,
      });
      if (failure) throw failure;
      form.reset();
      await refresh();
    } catch (cause) {
      setError(explain(cause));
    } finally {
      setBusy(false);
    }
  }

  async function addPlace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || !user) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError('');
    try {
      const { error: failure } = await client.from('profile_places').insert({
        profile_id: user.id,
        name: String(data.get('name')).trim(),
        place_type: String(data.get('place_type')),
        location_label: String(data.get('location_label')).trim(),
        note: String(data.get('note')).trim(),
        visibility: data.get('visibility') === 'private' ? 'private' : 'public',
        sort_order: places.length,
      });
      if (failure) throw failure;
      form.reset();
      await refresh();
    } catch (cause) {
      setError(explain(cause));
    } finally {
      setBusy(false);
    }
  }

  async function removeChild(table: 'profile_links' | 'profile_places', id: string) {
    if (!client || !user) return;
    setBusy(true);
    setError('');
    try {
      const { error: failure } = await client
        .from(table)
        .delete()
        .eq('id', id)
        .eq('profile_id', user.id);
      if (failure) throw failure;
      await refresh();
    } catch (cause) {
      setError(explain(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`${styles.card} ${editorStyles.editorCard}`}>
      <div className={editorStyles.headingRow}>
        <div>
          <span className={styles.eyebrow}>Your public identity</span>
          <h2>Build a profile worth sharing.</h2>
          <p className={styles.muted}>
            This is what people should see when they meet you through Constellation or a Circle. Make it feel like you, not a settings record.
          </p>
        </div>
        {visible && handle && (
          <Link href={`/people/${handle}`} className={styles.button}>
            View public profile
          </Link>
        )}
      </div>

      <form className={styles.form} onSubmit={saveProfile}>
        <div className={styles.split}>
          <label>
            Display name
            <input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Public handle
            <div className={editorStyles.handleInput}>
              <span>@</span>
              <input
                maxLength={30}
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                placeholder="yourhandle"
              />
            </div>
          </label>
        </div>

        <label>
          Travel philosophy
          <input
            maxLength={160}
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="Powder, good food, and people who say yes to the story."
          />
        </label>

        <div className={styles.split}>
          <label>
            Avatar image URL
            <input type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" />
          </label>
          <label>
            Cover image URL
            <input type="url" value={heroUrl} onChange={(e) => setHeroUrl(e.target.value)} placeholder="https://…" />
          </label>
        </div>
        <span className={styles.small}>For this first slice, images stay at their source URL. Native uploads come after storage and moderation are wired correctly.</span>

        <div className={styles.split}>
          <label>
            Home city
            <input maxLength={120} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Atlanta, Georgia" />
          </label>
          <label>
            Home airport
            <input maxLength={4} value={homeAirport} onChange={(e) => setHomeAirport(e.target.value.toUpperCase())} placeholder="KATL" />
          </label>
        </div>
        <div className={editorStyles.privacyRow}>
          <label className={styles.check}><input type="checkbox" checked={showCity} onChange={(e) => setShowCity(e.target.checked)} />Show home city publicly</label>
          <label className={styles.check}><input type="checkbox" checked={showAirport} onChange={(e) => setShowAirport(e.target.checked)} />Show home airport publicly</label>
        </div>

        <label>
          Broad interests
          <input maxLength={400} value={interests} onChange={(e) => setInterests(e.target.value)} placeholder="Skiing, food, Formula 1, art" />
          <span className={styles.small}>These describe you. Travel Modes describe the version of you taking a particular kind of trip.</span>
        </label>

        <label>
          About you
          <textarea maxLength={600} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="The trips you love, the people you click with, and the experiences you will always make time for." />
        </label>

        <div className={styles.split}>
          <label>
            Profile atmosphere
            <select value={theme} onChange={(e) => setTheme(e.target.value as ProfileThemeVariant)}>
              {THEMES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Accent
            <select value={accent} onChange={(e) => setAccent(e.target.value as ProfileAccent)}>
              {ACCENTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>

        <label className={styles.check}>
          <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
          Publish my traveler profile
        </label>
        <p className={styles.small}>
          Publishing your profile does not publish private Travel Modes, private Circle details, email, or precise live location. Featured Travel Modes must also be discoverable before they can appear publicly.
        </p>

        <button className={styles.button} disabled={busy || !ready}>{busy ? 'Saving…' : 'Save profile identity'}</button>
      </form>

      <div className={editorStyles.subgrid}>
        <section className={editorStyles.subpanel}>
          <span className={styles.eyebrow}>Elsewhere</span>
          <h3>Social and personal links</h3>
          <div className={editorStyles.items}>
            {links.map((link) => (
              <div key={link.id} className={editorStyles.item}>
                <div><strong>{link.label || link.kind}</strong><span>{link.visibility} · {link.kind}</span></div>
                <button type="button" disabled={busy} onClick={() => void removeChild('profile_links', link.id)}>Remove</button>
              </div>
            ))}
          </div>
          <form className={styles.form} onSubmit={addLink}>
            <div className={styles.split}>
              <label>Type<select name="kind" defaultValue="instagram"><option value="instagram">Instagram</option><option value="youtube">YouTube</option><option value="website">Website</option><option value="other">Other</option></select></label>
              <label>Visibility<select name="visibility" defaultValue="public"><option value="public">Public</option><option value="private">Private</option></select></label>
            </div>
            <label>Label<input name="label" maxLength={60} placeholder="My travel videos" /></label>
            <label>HTTPS URL<input name="url" type="url" required pattern="https://.*" placeholder="https://…" /></label>
            <button className={`${styles.button} ${styles.secondary}`} disabled={busy}>Add link</button>
          </form>
        </section>

        <section className={editorStyles.subpanel}>
          <span className={styles.eyebrow}>Places that say something about you</span>
          <h3>Places you stand behind</h3>
          <div className={editorStyles.items}>
            {places.map((place) => (
              <div key={place.id} className={editorStyles.item}>
                <div><strong>{place.name}</strong><span>{place.visibility} · {place.place_type}</span></div>
                <button type="button" disabled={busy} onClick={() => void removeChild('profile_places', place.id)}>Remove</button>
              </div>
            ))}
          </div>
          <form className={styles.form} onSubmit={addPlace}>
            <div className={styles.split}>
              <label>Place name<input name="name" required maxLength={120} placeholder="Aspen" /></label>
              <label>Type<select name="place_type" defaultValue="city"><option value="city">City</option><option value="venue">Venue</option><option value="resort">Resort</option><option value="region">Region</option><option value="other">Other</option></select></label>
            </div>
            <label>Location<input name="location_label" maxLength={160} placeholder="Colorado" /></label>
            <label>Why it matters<textarea name="note" maxLength={300} placeholder="The place I will always go back to…" /></label>
            <label>Visibility<select name="visibility" defaultValue="public"><option value="public">Public</option><option value="private">Private</option></select></label>
            <button className={`${styles.button} ${styles.secondary}`} disabled={busy}>Add place</button>
          </form>
        </section>
      </div>

      {notice && <p role="status" className={styles.notice}>{notice}</p>}
      {error && <p role="alert" className={`${styles.notice} ${styles.error}`}>{error}</p>}
    </section>
  );
}
