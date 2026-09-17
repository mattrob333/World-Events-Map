'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { PlatformShell, SignInCard } from '@/components/community/PlatformShell';
import { usePlatformAuth } from '@/lib/platform/usePlatformAuth';
import {
  detectContentProvider,
  displayHost,
  normalizeExternalUrl,
  youtubeVideoId,
  type TravelContentProvider,
} from '@/lib/profile';
import styles from './hype.module.css';

type CircleSummary = {
  id: string;
  name: string;
  destination: string;
  departure_city: string;
  start_date: string | null;
  end_date: string | null;
};

type ShareRow = {
  content_id: string;
  shared_by: string;
  caption: string;
  created_at: string;
};

type SavedRow = {
  id: string;
  provider: TravelContentProvider;
  url: string;
  title: string;
  note: string;
  destination: string;
};

type BoardPin = SavedRow & {
  sharedBy: string;
  sharedByName: string;
  caption: string;
  sharedAt: string;
};

function explain(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  if (cause && typeof cause === 'object' && 'message' in cause) return String(cause.message);
  return 'Something went wrong. Please try again.';
}

function daysUntil(value: string | null): number | null {
  if (!value) return null;
  const target = Date.parse(`${value}T12:00:00`);
  if (!Number.isFinite(target)) return null;
  return Math.ceil((target - Date.now()) / 86_400_000);
}

export function Hypeboard() {
  const { client, user } = usePlatformAuth();
  const [circles, setCircles] = useState<CircleSummary[]>([]);
  const [selectedCircleId, setSelectedCircleId] = useState('');
  const [pins, setPins] = useState<BoardPin[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadCircles = useCallback(async () => {
    if (!client || !user) return;
    setLoading(true);
    setError('');
    try {
      const memberships = await client
        .from('circle_members')
        .select('circle_id')
        .eq('user_id', user.id)
        .eq('status', 'accepted');
      if (memberships.error) throw memberships.error;
      const ids = (memberships.data ?? []).map((item) => item.circle_id);
      if (ids.length === 0) {
        setCircles([]);
        setSelectedCircleId('');
        return;
      }
      const result = await client
        .from('circles')
        .select('id,name,destination,departure_city,start_date,end_date')
        .in('id', ids)
        .order('start_date', { ascending: true });
      if (result.error) throw result.error;
      const next = (result.data ?? []) as CircleSummary[];
      setCircles(next);
      setSelectedCircleId((current) =>
        current && next.some((circle) => circle.id === current) ? current : next[0]?.id ?? '',
      );
    } catch (cause) {
      setError(
        `${explain(cause)} If this is a fresh environment, apply migration 004_traveler_profiles_and_inspiration.sql.`,
      );
    } finally {
      setLoading(false);
    }
  }, [client, user]);

  const loadPins = useCallback(async () => {
    if (!client || !user || !selectedCircleId) {
      setPins([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const shares = await client
        .from('circle_content')
        .select('content_id,shared_by,caption,created_at')
        .eq('circle_id', selectedCircleId)
        .order('created_at', { ascending: false });
      if (shares.error) throw shares.error;
      const shareRows = (shares.data ?? []) as ShareRow[];
      if (shareRows.length === 0) {
        setPins([]);
        return;
      }

      const contentIds = [...new Set(shareRows.map((item) => item.content_id))];
      const memberIds = [...new Set(shareRows.map((item) => item.shared_by))];
      const [saved, people] = await Promise.all([
        client
          .from('saved_content')
          .select('id,provider,url,title,note,destination')
          .in('id', contentIds),
        client.from('profiles').select('id,display_name').in('id', memberIds),
      ]);
      if (saved.error) throw saved.error;
      if (people.error) throw people.error;

      const savedMap = new Map((saved.data ?? []).map((item) => [item.id, item as SavedRow]));
      const peopleMap = new Map(
        (people.data ?? []).map((item) => [item.id, item.display_name || 'MERIDIAN traveler']),
      );
      setPins(
        shareRows.flatMap((share) => {
          const item = savedMap.get(share.content_id);
          if (!item) return [];
          return [
            {
              ...item,
              sharedBy: share.shared_by,
              sharedByName: peopleMap.get(share.shared_by) ?? 'MERIDIAN traveler',
              caption: share.caption,
              sharedAt: share.created_at,
            },
          ];
        }),
      );
    } catch (cause) {
      setError(explain(cause));
    } finally {
      setLoading(false);
    }
  }, [client, selectedCircleId, user]);

  useEffect(() => {
    void loadCircles();
  }, [loadCircles]);

  useEffect(() => {
    void loadPins();
  }, [loadPins]);

  const selected = useMemo(
    () => circles.find((circle) => circle.id === selectedCircleId) ?? null,
    [circles, selectedCircleId],
  );
  const countdown = daysUntil(selected?.start_date ?? null);

  async function share(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || !selected) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const rawUrl = String(data.get('url') ?? '');
    const url = normalizeExternalUrl(rawUrl);
    if (!url) {
      setError('Share a valid https link.');
      return;
    }
    const provider = detectContentProvider(url);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { error: failure } = await client.rpc('share_circle_content', {
        target_circle: selected.id,
        content_url: url,
        content_provider: provider,
        content_title: String(data.get('title') ?? '').trim(),
        content_note: String(data.get('note') ?? '').trim(),
        content_destination: String(data.get('destination') ?? '').trim(),
        share_caption: String(data.get('caption') ?? '').trim(),
      });
      if (failure) throw failure;
      form.reset();
      setNotice('Added to the Hypeboard.');
      await loadPins();
    } catch (cause) {
      setError(explain(cause));
    } finally {
      setBusy(false);
    }
  }

  async function removePin(contentId: string) {
    if (!client || !selected) return;
    setBusy(true);
    setError('');
    try {
      const { error: failure } = await client
        .from('circle_content')
        .delete()
        .eq('circle_id', selected.id)
        .eq('content_id', contentId);
      if (failure) throw failure;
      await loadPins();
    } catch (cause) {
      setError(explain(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PlatformShell
      eyebrow="Anticipation is part of the trip"
      title="Build the trip before you take it."
      description="Drop the videos, places, photos and rabbit holes that get the whole Circle fired up. The plan becomes a shared story before anybody boards a plane."
    >
      {!user ? (
        <div className={styles.workspace}>
          <SignInCard />
          <aside className={styles.card}>
            <span className={styles.eyebrow}>Private to your Circle</span>
            <h2>The pre-trip group chat deserves better than a pile of links.</h2>
            <p className={styles.muted}>
              MERIDIAN turns those links into a shared board your crew can actually come back to.
            </p>
          </aside>
        </div>
      ) : circles.length === 0 && !loading ? (
        <section className={styles.empty}>
          You are not in an accepted travel Circle yet. Start or join one first, then its Hypeboard will live here.
          <div className={styles.actions}>
            <a className={styles.button} href="/community">Find a Circle</a>
            <a className={styles.quietButton} href="/constellation">Open Constellation</a>
          </div>
        </section>
      ) : (
        <div className={styles.workspace}>
          <aside className={styles.sidebar}>
            <div>
              <span className={styles.eyebrow}>Your Circles</span>
              <h2>Pick the trip.</h2>
            </div>
            <select
              className={styles.select}
              value={selectedCircleId}
              onChange={(event) => setSelectedCircleId(event.target.value)}
            >
              {circles.map((circle) => (
                <option key={circle.id} value={circle.id}>{circle.name}</option>
              ))}
            </select>
            {selected && (
              <div>
                <p className={styles.small}>{selected.destination}</p>
                {selected.departure_city && <p className={styles.small}>Starting from {selected.departure_city}</p>}
              </div>
            )}
            <div className={styles.actions}>
              <a href="/community" className={styles.quietButton}>Circle chat</a>
              <a href="/profile" className={styles.quietButton}>Your profile</a>
            </div>
          </aside>

          <div>
            {selected && (
              <section className={styles.hero}>
                <div className={styles.heroTop}>
                  <div>
                    <span className={styles.eyebrow}>Hypeboard · {selected.destination}</span>
                    <h2>{selected.name}</h2>
                    <p className={styles.muted}>
                      Save the stuff that makes everyone say “we have to do that.” The board survives the chat scroll.
                    </p>
                  </div>
                  {countdown !== null && (
                    <div className={styles.countdown}>
                      <strong>{countdown > 0 ? countdown : 0}</strong>
                      <span>{countdown > 1 ? 'days to go' : countdown === 1 ? 'day to go' : 'trip time'}</span>
                    </div>
                  )}
                </div>
              </section>
            )}

            <section className={styles.card} style={{ marginTop: 16 }}>
              <span className={styles.eyebrow}>Add to the board</span>
              <h2>What got you excited?</h2>
              <form className={styles.form} onSubmit={share}>
                <label>
                  Link
                  <input className={styles.input} name="url" type="url" required placeholder="https://youtube.com/watch?v=..." />
                </label>
                <div className={styles.split}>
                  <label>
                    Title
                    <input className={styles.input} name="title" maxLength={180} placeholder="Courchevel village walkthrough" />
                  </label>
                  <label>
                    Destination
                    <input className={styles.input} name="destination" maxLength={120} defaultValue={selected?.destination ?? ''} key={selected?.id ?? 'none'} />
                  </label>
                </div>
                <label>
                  Your take
                  <textarea className={styles.textarea} name="caption" maxLength={800} placeholder="Watch the last five minutes. This is the place I was talking about." />
                </label>
                <label>
                  Notes for later
                  <input className={styles.input} name="note" maxLength={1200} placeholder="Restaurant name, lift, neighborhood, reservation detail…" />
                </label>
                <button className={styles.button} disabled={busy || !selected}>
                  {busy ? 'Adding…' : 'Add to Hypeboard'}
                </button>
              </form>
              {notice && <p className={styles.notice}>{notice}</p>}
              {error && <p className={styles.error}>{error}</p>}
            </section>

            <section className={styles.card} style={{ marginTop: 16 }}>
              <span className={styles.eyebrow}>The board</span>
              <h2>{pins.length ? `${pins.length} reasons to get excited.` : 'Start the rabbit hole.'}</h2>
              {loading && pins.length === 0 ? (
                <p className={styles.empty}>Loading the Circle board…</p>
              ) : pins.length === 0 ? (
                <p className={styles.empty}>No links yet. Be the first person to drop something worth watching.</p>
              ) : (
                <div className={styles.feed}>
                  {pins.map((pin) => (
                    <PinCard
                      key={pin.id}
                      pin={pin}
                      mine={pin.sharedBy === user.id}
                      busy={busy}
                      onRemove={() => void removePin(pin.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </PlatformShell>
  );
}

function PinCard({
  pin,
  mine,
  busy,
  onRemove,
}: {
  pin: BoardPin;
  mine: boolean;
  busy: boolean;
  onRemove: () => void;
}) {
  const youtubeId = pin.provider === 'youtube' ? youtubeVideoId(pin.url) : null;
  return (
    <article className={styles.pin}>
      {(youtubeId || pin.provider === 'image') && (
        <div className={styles.media}>
          {youtubeId ? (
            <iframe
              src={`https://www.youtube.com/embed/${youtubeId}`}
              title={pin.title || 'Travel video'}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <img src={pin.url} alt={pin.title || pin.destination || 'Travel inspiration'} />
          )}
        </div>
      )}
      <div className={styles.pinBody}>
        <span className={styles.eyebrow}>{pin.destination || pin.provider}</span>
        <h3>{pin.title || 'Travel inspiration'}</h3>
        {pin.caption && <p>{pin.caption}</p>}
        {pin.note && <p>{pin.note}</p>}
        {!youtubeId && pin.provider !== 'image' && (
          <a className={styles.quietButton} href={pin.url} target="_blank" rel="noreferrer">
            Open on {displayHost(pin.url)} ↗
          </a>
        )}
        <div className={styles.pinMeta}>
          <span>Shared by {pin.sharedByName}</span>
          {mine && (
            <button className={styles.dangerButton} disabled={busy} onClick={onRemove}>
              Remove
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
