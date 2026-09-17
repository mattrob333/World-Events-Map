'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { PlatformShell, SignInCard } from '@/components/community/PlatformShell';
import { usePlatformAuth } from '@/lib/platform/usePlatformAuth';
import {
  detectContentProvider,
  normalizeExternalUrl,
  profileCompleteness,
  profileMilestones,
  type ProfileLinkKind,
  type ProfilePlaceKind,
  type ProfileTheme,
  type PublicProfileContent,
  type PublicProfileLink,
  type PublicProfilePlace,
  type TravelerProfileDraft,
} from '@/lib/profile';
import styles from './profile.module.css';

const THEMES: { value: ProfileTheme; label: string }[] = [
  { value: 'midnight', label: 'Midnight' },
  { value: 'alpine', label: 'Alpine' },
  { value: 'coastal', label: 'Coastal' },
  { value: 'desert', label: 'Desert' },
  { value: 'city', label: 'City after dark' },
];

const LINK_KINDS: { value: ProfileLinkKind; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'website', label: 'Website' },
  { value: 'other', label: 'Other' },
];

const PLACE_KINDS: { value: ProfilePlaceKind; label: string }[] = [
  { value: 'favorite', label: 'Favorite' },
  { value: 'visited', label: 'Visited' },
  { value: 'bucket', label: 'Bucket list' },
];

const EMPTY_PROFILE: TravelerProfileDraft = {
  display_name: '',
  handle: '',
  headline: '',
  bio: '',
  avatar_url: '',
  cover_url: '',
  profile_theme: 'midnight',
  home_city: '',
  home_airport: '',
  interests: [],
  is_public: false,
  show_home_base: true,
  show_travel_modes: true,
};

function explain(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  if (cause && typeof cause === 'object' && 'message' in cause) return String(cause.message);
  return 'Something went wrong. Please try again.';
}

export function ProfileStudio() {
  const { client, user } = usePlatformAuth();
  const [profile, setProfile] = useState<TravelerProfileDraft>(EMPTY_PROFILE);
  const [interestsText, setInterestsText] = useState('');
  const [links, setLinks] = useState<PublicProfileLink[]>([]);
  const [places, setPlaces] = useState<PublicProfilePlace[]>([]);
  const [content, setContent] = useState<PublicProfileContent[]>([]);
  const [travelModeCount, setTravelModeCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    if (!client || !user) return;
    setLoading(true);
    setError('');
    try {
      const [profileResult, linkResult, placeResult, pinResult, modeResult] = await Promise.all([
        client
          .from('profiles')
          .select(
            'display_name,handle,headline,bio,avatar_url,cover_url,profile_theme,home_city,home_airport,interests,is_public,show_home_base,show_travel_modes',
          )
          .eq('id', user.id)
          .maybeSingle(),
        client
          .from('profile_links')
          .select('id,kind,label,url')
          .eq('user_id', user.id)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
        client
          .from('profile_places')
          .select('id,kind,place_name,country_code,note,visited_on')
          .eq('user_id', user.id)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
        client
          .from('profile_content')
          .select('content_id,is_public,sort_order')
          .eq('user_id', user.id)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
        client.from('travel_modes').select('id').eq('user_id', user.id),
      ]);

      const failure =
        profileResult.error ||
        linkResult.error ||
        placeResult.error ||
        pinResult.error ||
        modeResult.error;
      if (failure) throw failure;

      const row = profileResult.data;
      const interests = Array.isArray(row?.interests) ? row.interests : [];
      const nextProfile: TravelerProfileDraft = {
        display_name: row?.display_name ?? '',
        handle: row?.handle ?? '',
        headline: row?.headline ?? '',
        bio: row?.bio ?? '',
        avatar_url: row?.avatar_url ?? '',
        cover_url: row?.cover_url ?? '',
        profile_theme: (row?.profile_theme ?? 'midnight') as ProfileTheme,
        home_city: row?.home_city ?? '',
        home_airport: row?.home_airport ?? '',
        interests,
        is_public: row?.is_public === true,
        show_home_base: row?.show_home_base !== false,
        show_travel_modes: row?.show_travel_modes !== false,
      };
      setProfile(nextProfile);
      setInterestsText(interests.join(', '));
      setLinks((linkResult.data ?? []) as PublicProfileLink[]);
      setPlaces((placeResult.data ?? []) as PublicProfilePlace[]);
      setTravelModeCount((modeResult.data ?? []).length);

      const pinnedIds = (pinResult.data ?? []).map((item) => item.content_id);
      if (pinnedIds.length === 0) {
        setContent([]);
      } else {
        const saved = await client
          .from('saved_content')
          .select('id,provider,url,title,note,destination')
          .in('id', pinnedIds);
        if (saved.error) throw saved.error;
        const order = new Map(pinnedIds.map((id, index) => [id, index]));
        setContent(
          ((saved.data ?? []) as PublicProfileContent[]).sort(
            (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
          ),
        );
      }
    } catch (cause) {
      setError(
        `${explain(cause)}${
          explain(cause).includes('profile_') || explain(cause).includes('handle')
            ? ''
            : ' If this is a fresh environment, apply migration 004_traveler_profiles_and_inspiration.sql.'
        }`,
      );
    } finally {
      setLoading(false);
    }
  }, [client, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const normalizedInterests = useMemo(
    () => [
      ...new Set(
        interestsText
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ].slice(0, 16),
    [interestsText],
  );

  const previewProfile = useMemo(
    () => ({ ...profile, interests: normalizedInterests }),
    [profile, normalizedInterests],
  );

  const inventory = useMemo(
    () => ({
      links: links.length,
      places: places.length,
      content: content.length,
      travelModes: travelModeCount,
    }),
    [links.length, places.length, content.length, travelModeCount],
  );
  const completeness = profileCompleteness(previewProfile, inventory);
  const milestones = profileMilestones(previewProfile, inventory);

  async function saveIdentity(event: FormEvent) {
    event.preventDefault();
    if (!client || !user) return;
    const handle = profile.handle.trim().toLowerCase();
    if (handle && !/^[a-z0-9][a-z0-9_-]{2,29}$/.test(handle)) {
      setError('Handles use 3–30 lowercase letters, numbers, underscores or hyphens.');
      return;
    }
    const avatar = profile.avatar_url ? normalizeExternalUrl(profile.avatar_url) : '';
    const cover = profile.cover_url ? normalizeExternalUrl(profile.cover_url) : '';
    if (profile.avatar_url && !avatar) {
      setError('Avatar image must use a valid https URL.');
      return;
    }
    if (profile.cover_url && !cover) {
      setError('Cover image must use a valid https URL.');
      return;
    }
    if (profile.is_public && !handle) {
      setError('Claim a handle before publishing your traveler profile.');
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { error: failure } = await client.from('profiles').upsert({
        id: user.id,
        display_name: profile.display_name.trim(),
        handle,
        headline: profile.headline.trim(),
        bio: profile.bio.trim(),
        avatar_url: avatar || '',
        cover_url: cover || '',
        profile_theme: profile.profile_theme,
        home_city: profile.home_city.trim(),
        home_airport: profile.home_airport.trim().toUpperCase(),
        interests: normalizedInterests,
        is_public: profile.is_public,
        show_home_base: profile.show_home_base,
        show_travel_modes: profile.show_travel_modes,
      });
      if (failure) throw failure;
      setNotice('Traveler profile saved.');
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
    const url = normalizeExternalUrl(String(data.get('url') ?? ''));
    if (!url) {
      setError('Social and web links must use https.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { error: failure } = await client.from('profile_links').insert({
        user_id: user.id,
        kind: String(data.get('kind')),
        label: String(data.get('label')).trim(),
        url,
        is_public: true,
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
        user_id: user.id,
        kind: String(data.get('kind')),
        place_name: String(data.get('place_name')).trim(),
        country_code: String(data.get('country_code')).trim().toUpperCase(),
        note: String(data.get('note')).trim(),
        is_public: true,
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

  async function pinContent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const rawUrl = String(data.get('url') ?? '');
    const url = normalizeExternalUrl(rawUrl);
    if (!url) {
      setError('Pinned content must use a valid https URL.');
      return;
    }
    const provider = detectContentProvider(url);
    setBusy(true);
    setError('');
    try {
      const { error: failure } = await client.rpc('pin_profile_content', {
        content_url: url,
        content_provider: provider,
        content_title: String(data.get('title')).trim(),
        content_note: String(data.get('note')).trim(),
        content_destination: String(data.get('destination')).trim(),
        content_public: true,
      });
      if (failure) throw failure;
      form.reset();
      setNotice('Pinned to your traveler profile.');
      await refresh();
    } catch (cause) {
      setError(explain(cause));
    } finally {
      setBusy(false);
    }
  }

  async function remove(table: 'profile_links' | 'profile_places', id: string) {
    if (!client || !user) return;
    setBusy(true);
    setError('');
    try {
      const { error: failure } = await client
        .from(table)
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (failure) throw failure;
      await refresh();
    } catch (cause) {
      setError(explain(cause));
    } finally {
      setBusy(false);
    }
  }

  async function unpin(contentId: string) {
    if (!client || !user) return;
    setBusy(true);
    setError('');
    try {
      const { error: failure } = await client
        .from('profile_content')
        .delete()
        .eq('content_id', contentId)
        .eq('user_id', user.id);
      if (failure) throw failure;
      await refresh();
    } catch (cause) {
      setError(explain(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PlatformShell
      eyebrow="Your travel identity"
      title="Build the profile worth sharing."
      description="This should feel less like account setup and more like making the traveler page you would actually send to somebody you just met on a trip."
    >
      {!user ? (
        <div className={styles.studioGrid}>
          <SignInCard />
          <aside className={styles.card}>
            <span className={styles.eyebrow}>More than a login</span>
            <h2>Your traveler identity lives here.</h2>
            <p className={styles.muted}>
              Build a public page around the places you love, the trips you want, the way you travel and the things that get you excited to go.
            </p>
          </aside>
        </div>
      ) : (
        <div className={styles.studioGrid}>
          <div className={styles.stack}>
            <section className={styles.card}>
              <span className={styles.eyebrow}>Identity</span>
              <h2>Make it yours.</h2>
              <p className={styles.muted}>
                MySpace energy, modern guardrails. Pick the look, tell the story, and decide exactly what is public.
              </p>
              <form className={styles.form} onSubmit={saveIdentity}>
                <div className={styles.split}>
                  <label>
                    Display name
                    <input
                      required
                      maxLength={100}
                      value={profile.display_name}
                      onChange={(event) =>
                        setProfile((current) => ({ ...current, display_name: event.target.value }))
                      }
                    />
                  </label>
                  <label>
                    MERIDIAN handle
                    <input
                      maxLength={30}
                      value={profile.handle}
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          handle: event.target.value.toLowerCase().replace(/\s+/g, '_'),
                        }))
                      }
                      placeholder="matt_travels"
                    />
                  </label>
                </div>
                <label>
                  Headline
                  <input
                    maxLength={140}
                    value={profile.headline}
                    onChange={(event) =>
                      setProfile((current) => ({ ...current, headline: event.target.value }))
                    }
                    placeholder="Mountains, F1 weekends, great food and a good crew."
                  />
                </label>
                <label>
                  Your traveler story
                  <textarea
                    maxLength={600}
                    value={profile.bio}
                    onChange={(event) =>
                      setProfile((current) => ({ ...current, bio: event.target.value }))
                    }
                    placeholder="How do you travel? What makes a trip great for you? What kind of people do you click with?"
                  />
                </label>
                <div className={styles.split}>
                  <label>
                    Home city
                    <input
                      maxLength={120}
                      value={profile.home_city}
                      onChange={(event) =>
                        setProfile((current) => ({ ...current, home_city: event.target.value }))
                      }
                    />
                  </label>
                  <label>
                    Home airport
                    <input
                      maxLength={4}
                      value={profile.home_airport}
                      onChange={(event) =>
                        setProfile((current) => ({
                          ...current,
                          home_airport: event.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="KATL"
                    />
                  </label>
                </div>
                <label>
                  Broad interests
                  <input
                    maxLength={500}
                    value={interestsText}
                    onChange={(event) => setInterestsText(event.target.value)}
                    placeholder="Skiing, food, Formula 1, live music, sailing"
                  />
                  <span className={styles.small}>Separate with commas. Travel Modes add the trip-specific context.</span>
                </label>
                <div className={styles.split}>
                  <label>
                    Avatar image URL
                    <input
                      type="url"
                      value={profile.avatar_url}
                      onChange={(event) =>
                        setProfile((current) => ({ ...current, avatar_url: event.target.value }))
                      }
                      placeholder="https://..."
                    />
                  </label>
                  <label>
                    Cover image URL
                    <input
                      type="url"
                      value={profile.cover_url}
                      onChange={(event) =>
                        setProfile((current) => ({ ...current, cover_url: event.target.value }))
                      }
                      placeholder="https://..."
                    />
                  </label>
                </div>
                <label>
                  Profile atmosphere
                  <select
                    value={profile.profile_theme}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        profile_theme: event.target.value as ProfileTheme,
                      }))
                    }
                  >
                    {THEMES.map((theme) => (
                      <option key={theme.value} value={theme.value}>
                        {theme.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={profile.show_home_base}
                    onChange={(event) =>
                      setProfile((current) => ({ ...current, show_home_base: event.target.checked }))
                    }
                  />
                  Show my home base on the public profile
                </label>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={profile.show_travel_modes}
                    onChange={(event) =>
                      setProfile((current) => ({ ...current, show_travel_modes: event.target.checked }))
                    }
                  />
                  Show my discoverable Travel Modes publicly
                </label>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={profile.is_public}
                    onChange={(event) =>
                      setProfile((current) => ({ ...current, is_public: event.target.checked }))
                    }
                  />
                  Publish my traveler profile
                </label>
                <button className={styles.button} disabled={busy || loading}>
                  {busy ? 'Saving…' : 'Save traveler profile'}
                </button>
              </form>
            </section>

            <section className={styles.card}>
              <span className={styles.eyebrow}>Places</span>
              <h2>Build your map without making it a spreadsheet.</h2>
              <div className={styles.list}>
                {places.map((place) => (
                  <div key={place.id} className={styles.listItem}>
                    <div>
                      <strong>{place.place_name}</strong>
                      <span>{place.kind}{place.country_code ? ` · ${place.country_code}` : ''}</span>
                      {place.note && <p>{place.note}</p>}
                    </div>
                    <button
                      className={styles.dangerButton}
                      disabled={busy}
                      onClick={() => void remove('profile_places', place.id)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <form className={styles.form} onSubmit={addPlace}>
                <div className={styles.split}>
                  <label>
                    Shelf
                    <select name="kind" defaultValue="favorite">
                      {PLACE_KINDS.map((kind) => (
                        <option key={kind.value} value={kind.value}>{kind.label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Country code
                    <input name="country_code" maxLength={2} placeholder="FR" />
                  </label>
                </div>
                <label>
                  Place
                  <input name="place_name" required maxLength={120} placeholder="Courchevel" />
                </label>
                <label>
                  Why it matters
                  <input name="note" maxLength={400} placeholder="Favorite ski week. Great food, huge terrain." />
                </label>
                <button className={styles.secondaryButton} disabled={busy}>Add place</button>
              </form>
            </section>

            <section className={styles.card}>
              <span className={styles.eyebrow}>Around the web</span>
              <h2>Connect the places you already express yourself.</h2>
              <p className={styles.small}>
                Personal Instagram feed importing is restricted by Meta. For now MERIDIAN links cleanly to any account; professional-account and public-post integrations can plug in later.
              </p>
              <div className={styles.list}>
                {links.map((link) => (
                  <div key={link.id} className={styles.listItem}>
                    <div>
                      <strong>{link.label}</strong>
                      <span>{link.kind}</span>
                    </div>
                    <button
                      className={styles.dangerButton}
                      disabled={busy}
                      onClick={() => void remove('profile_links', link.id)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <form className={styles.form} onSubmit={addLink}>
                <div className={styles.split}>
                  <label>
                    Type
                    <select name="kind" defaultValue="instagram">
                      {LINK_KINDS.map((kind) => (
                        <option key={kind.value} value={kind.value}>{kind.label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Label
                    <input name="label" required maxLength={60} placeholder="My Instagram" />
                  </label>
                </div>
                <label>
                  URL
                  <input name="url" required type="url" placeholder="https://instagram.com/..." />
                </label>
                <button className={styles.secondaryButton} disabled={busy}>Add link</button>
              </form>
            </section>

            <section className={styles.card}>
              <span className={styles.eyebrow}>Your travel wall</span>
              <h2>Pin what makes you want to go.</h2>
              <p className={styles.muted}>
                Videos, Instagram posts, photos and guides can live beside your travel story. YouTube links render directly on your public profile.
              </p>
              <div className={styles.list}>
                {content.map((item) => (
                  <div key={item.id} className={styles.listItem}>
                    <div>
                      <strong>{item.title || item.destination || 'Travel inspiration'}</strong>
                      <span>{item.provider}{item.destination ? ` · ${item.destination}` : ''}</span>
                    </div>
                    <button className={styles.dangerButton} disabled={busy} onClick={() => void unpin(item.id)}>
                      Unpin
                    </button>
                  </div>
                ))}
              </div>
              <form className={styles.form} onSubmit={pinContent}>
                <label>
                  Link
                  <input name="url" required type="url" placeholder="https://youtube.com/watch?v=..." />
                </label>
                <div className={styles.split}>
                  <label>
                    Title
                    <input name="title" maxLength={180} placeholder="Why Courchevel is unreal" />
                  </label>
                  <label>
                    Destination
                    <input name="destination" maxLength={120} placeholder="Courchevel, France" />
                  </label>
                </div>
                <label>
                  Your note
                  <textarea name="note" maxLength={1200} placeholder="This is the video that made me book the trip." />
                </label>
                <button className={styles.secondaryButton} disabled={busy}>Pin to profile</button>
              </form>
            </section>
          </div>

          <aside className={styles.stack}>
            <ProfilePreview profile={previewProfile} links={links} />
            <section className={styles.card}>
              <div className={styles.progressWrap}>
                <div className={styles.progressTop}>
                  <div>
                    <span className={styles.eyebrow}>Profile build</span>
                    <h2>Make people want to know you.</h2>
                  </div>
                  <span className={styles.progressNumber}>{completeness}%</span>
                </div>
                <div className={styles.progressTrack} aria-label={`${completeness}% complete`}>
                  <div className={styles.progressFill} style={{ width: `${completeness}%` }} />
                </div>
                <ul className={styles.milestones}>
                  {milestones.map((milestone) => (
                    <li key={milestone.id} className={milestone.complete ? styles.complete : ''}>
                      <span>{milestone.complete ? '✓ ' : ''}{milestone.label}</span>
                      <span>{milestone.points}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={styles.actions}>
                <Link href="/account" className={styles.secondaryButton}>Travel Modes & settings</Link>
                <Link href="/hype" className={styles.secondaryButton}>Open Hypeboard</Link>
                {profile.is_public && profile.handle && (
                  <Link href={`/traveler/${profile.handle}`} className={styles.button}>View public profile</Link>
                )}
              </div>
            </section>
            {notice && <p className={styles.notice} role="status">{notice}</p>}
            {error && <p className={styles.error} role="alert">{error}</p>}
          </aside>
        </div>
      )}
    </PlatformShell>
  );
}

function ProfilePreview({
  profile,
  links,
}: {
  profile: TravelerProfileDraft;
  links: PublicProfileLink[];
}) {
  const initials =
    profile.display_name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'M';

  return (
    <section className={`${styles.preview} ${styles[`theme_${profile.profile_theme}`] ?? ''}`}>
      <div className={styles.cover}>
        {profile.cover_url && <img src={profile.cover_url} alt="" />}
      </div>
      <div className={styles.profileBody}>
        <div className={styles.avatar}>
          {profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : initials}
        </div>
        <span className={styles.handle}>@{profile.handle || 'your_handle'}</span>
        <h2 className={styles.displayName}>{profile.display_name || 'Your name'}</h2>
        <p className={styles.headline}>{profile.headline || 'What makes travel worth it for you?'}</p>
        {(profile.home_city || profile.home_airport) && (
          <div className={styles.metaRow}>
            <span>{[profile.home_city, profile.home_airport].filter(Boolean).join(' · ')}</span>
          </div>
        )}
        <div className={styles.chips}>
          {profile.interests.slice(0, 7).map((interest) => (
            <span key={interest} className={styles.chip}>{interest}</span>
          ))}
        </div>
        {links.length > 0 && (
          <div className={styles.metaRow}>
            <span>{links.map((link) => link.label).join(' · ')}</span>
          </div>
        )}
      </div>
    </section>
  );
}
