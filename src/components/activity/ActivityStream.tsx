'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useIntentStore } from '@/lib/intent/store';
import { curatedPhotoForEvent } from '@/lib/place-media/curated';
import type { PlacePhoto } from '@/lib/place-media/media';
import {
  ACTIVITY_FILTERS,
  ACTIVITY_SCENES,
  filterScenes,
  type ActivityFilter,
  type ActivityScene,
} from '@/lib/activity/stream';
import styles from './activity.module.css';

type ScenePost = {
  id: string;
  text: string;
  author: string;
  handle: string;
  createdAt: string;
  url: string;
};
type PostsState = { posts: ScenePost[]; fetchedAt: string | null; status: 'loading' | 'ready' | 'error' };

const formatDate = (value: string) =>
  new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });

function useScenePosts(eventId: string | undefined): PostsState {
  const [state, setState] = useState<PostsState & { eventId?: string }>({ posts: [], fetchedAt: null, status: 'loading' });
  useEffect(() => {
    if (!eventId) return;
    let disposed = false;
    let pending = false;
    let controller: AbortController | null = null;
    const refresh = async () => {
      if (document.hidden || pending) return;
      pending = true;
      controller = new AbortController();
      try {
        const response = await fetch(`/api/scene-posts?event=${encodeURIComponent(eventId)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Scene feed unavailable');
        const payload: { posts?: ScenePost[]; fetchedAt?: string | null } = await response.json();
        if (!disposed) setState({
          eventId,
          posts: Array.isArray(payload.posts) ? payload.posts : [],
          fetchedAt: payload.fetchedAt ?? null,
          status: 'ready',
        });
      } catch {
        if (!disposed && !controller?.signal.aborted) setState({ eventId, posts: [], fetchedAt: null, status: 'error' });
      } finally {
        pending = false;
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      disposed = true;
      controller?.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [eventId]);
  return state.eventId === eventId ? state : { posts: [], fetchedAt: null, status: 'loading' };
}

function SceneCard({ scene, featured, onFeature }: {
  scene: ActivityScene;
  featured: boolean;
  onFeature: () => void;
}) {
  const items = useIntentStore((state) => state.items);
  const toggle = useIntentStore((state) => state.toggle);
  const artRef = useRef<HTMLButtonElement>(null);
  // Our reviewed editorial photo leads; Commons fills in when there isn't one.
  const curated = curatedPhotoForEvent(scene.event.id);
  const [photos, setPhotos] = useState<PlacePhoto[]>(() => (curated ? [curated] : []));
  const [photoIndex, setPhotoIndex] = useState(0);
  const photo = photos[photoIndex];
  const saved = items.some((item) => item.verb === 'save' && item.kind === 'event' && item.id === scene.event.id);

  useEffect(() => {
    const node = artRef.current;
    if (!node) return;
    const controller = new AbortController();
    let started = false;
    const load = () => {
      if (started) return;
      started = true;
      fetch(`/api/place-media?eventId=${encodeURIComponent(scene.event.id)}`, { signal: controller.signal })
        .then((response) => response.ok ? response.json() as Promise<{ photos?: PlacePhoto[] }> : { photos: [] })
        .then((result) => {
          if (controller.signal.aborted) return;
          const photos = Array.isArray(result.photos) ? result.photos : [];
          const eventPhotos = photos.filter((item) => item.subject === 'event');
          const preferred = eventPhotos.findIndex((item) =>
            /crowd|people|audience|panoram|night|party|ski|yacht|sail|beach/i.test(item.title),
          );
          const orderedEvents = preferred > 0
            ? [eventPhotos[preferred], ...eventPhotos.filter((_, index) => index !== preferred)]
            : eventPhotos;
          const contextualPlacePhotos = photos.filter((item) => {
            if (item.subject !== 'place') return false;
            const title = item.title.toLowerCase();
            if (scene.category === 'ski') return /ski|snow|powder|slope/.test(title);
            if (scene.category === 'sailing') return /yacht|sail|boat|harbo[u]?r|port/.test(title);
            if (scene.category === 'nature') return /aurora|northern lights/.test(title);
            return false;
          });
          const found = orderedEvents.length ? orderedEvents : contextualPlacePhotos;
          const lead = curatedPhotoForEvent(scene.event.id);
          setPhotos(lead ? [lead, ...found.filter((item) => item.imageUrl !== lead.imageUrl)] : found);
          setPhotoIndex(0);
        })
        .catch(() => {});
    };
    if (!('IntersectionObserver' in window)) {
      load();
      return () => controller.abort();
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        load();
      }
    }, { rootMargin: '200px' });
    observer.observe(node);
    return () => { observer.disconnect(); controller.abort(); };
  }, [scene.event.id, scene.category]);

  return (
    <article className={`${styles.card} ${featured ? styles.cardFeatured : ''}`}>
      <div className={styles.visual}>
        <button ref={artRef} type="button" className={`${styles.art} ${styles[scene.art]}`} data-photo={photo ? 'true' : undefined} onClick={onFeature}
          aria-label={`Show posts for ${scene.event.name}`} aria-pressed={featured}>
          {photo && (
            // Server-approved Wikimedia URLs vary per file and do not need Next image optimization.
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.archiveImage} src={photo.imageUrl} alt="" loading="lazy" onError={() => {
              setPhotoIndex(0);
              setPhotos((current) => current.filter((item) => item.sourceUrl !== photo.sourceUrl));
            }} />
          )}
          <span className={styles.artTexture} aria-hidden="true" />
          <span className={styles.artTop}>{scene.kicker} <span>◦</span> {photo ? `${photo.subject.toUpperCase()} ARCHIVE` : 'EDITORIAL ART'}</span>
          <span className={styles.artWord}>{scene.event.city}</span>
          <span className={styles.artEvent}>{scene.event.name}</span>
          <span className={styles.artBottom}>{scene.event.country.toUpperCase()} <span>↗</span> {formatDate(scene.event.start)}</span>
        </button>
        {photos.length > 1 && <div className={styles.galleryControls} role="group" aria-label={`${scene.event.city} archive photos`}>
          <button type="button" onClick={() => setPhotoIndex((index) => (index - 1 + photos.length) % photos.length)} aria-label={`Previous ${scene.event.city} photo`}>‹</button>
          <span>{photoIndex + 1} / {photos.length}</span>
          <button type="button" onClick={() => setPhotoIndex((index) => (index + 1) % photos.length)} aria-label={`Next ${scene.event.city} photo`}>›</button>
        </div>}
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardMeta}><span className={styles.editorialMark}>M</span><span>dope.travel EDITORIAL</span><span className={styles.dot}>·</span><span>CURATED SCENE</span></div>
        <h3>{scene.line}</h3>
        <p>{scene.event.tagline}.</p>
        {photo && <a className={styles.photoCredit} href={photo.sourceUrl} target="_blank" rel="noopener noreferrer" title={photo.title}>
          {photo.subject === 'event' ? 'Event archive' : 'Place archive'}{photo.photographed ? ` · ${photo.photographed}` : ''} · {photo.credit} · {photo.license} · Wikimedia Commons ↗
        </a>}
        <div className={styles.tags}>{scene.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
        <div className={styles.cardActions}>
          <button type="button" className="chip" onClick={() => toggle({ verb: 'save', kind: 'event', id: scene.event.id, label: scene.event.name, href: scene.href })}
            aria-pressed={saved} aria-label={`${saved ? 'Remove saved' : 'Save'} ${scene.event.name}`}>
            <span aria-hidden="true">{saved ? '◆' : '◇'}</span> {saved ? 'Saved' : 'Save idea'}
          </button>
          <Link href={scene.href}>Explore the scene <span aria-hidden="true">↗</span></Link>
        </div>
      </div>
    </article>
  );
}

export function ActivityStream() {
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const scenes = useMemo(() => filterScenes(ACTIVITY_SCENES, filter), [filter]);
  const featured = scenes[featuredIndex % Math.max(scenes.length, 1)];
  const posts = useScenePosts(featured?.event.id);
  const intentItems = useIntentStore((state) => state.items);
  const savedItems = intentItems.filter((item) => item.verb === 'save' && item.kind === 'event');

  const selectFilter = (id: ActivityFilter) => { setFilter(id); setFeaturedIndex(0); };
  const sortedScenes = featured ? [featured, ...scenes.filter((scene) => scene.event.id !== featured.event.id)] : [];

  return (
    <section className={styles.stream} aria-label="Travel activity stream">
      <div className={styles.header}>
        <div className={styles.eyebrow}><span className={styles.eyebrowRule} /> PLACES THAT STAY WITH YOU <span className={styles.issue}>01 / DISCOVER</span></div>
        <div className={styles.titleRow}>
          <div><h2>Out in the <em>world.</em></h2><p>Scenes from the calendar. Follow a feeling.</p></div>
        </div>
      </div>
      <div className={styles.filters} aria-label="Filter scenes">
        {ACTIVITY_FILTERS.map(({ id, label }) => <button key={id} type="button" onClick={() => selectFilter(id)}
          className="chip" aria-pressed={filter === id}>{label}</button>)}
      </div>

      <div className={styles.layout}>
        <div className={styles.feed}>
          <div className={styles.feedHeading}><span>EDITORIAL SCENES · ARCHIVES & ART</span><span>{String(scenes.length).padStart(2, '0')} SCENES</span></div>
          <div className={styles.cards}>
            {(expanded ? sortedScenes : sortedScenes.slice(0, 2)).map((scene) => <SceneCard key={scene.event.id} scene={scene}
              featured={scene.event.id === featured?.event.id}
              onFeature={() => setFeaturedIndex(scenes.findIndex((item) => item.event.id === scene.event.id))} />)}
          </div>
          {sortedScenes.length > 2 && <button className={`btn btn-ghost ${styles.more}`} type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Show fewer scenes ↑' : `Explore ${sortedScenes.length - 2} more scenes ↓`}</button>}
        </div>

        {/* Only when there's something in it: an empty "no posts yet" box doesn't earn home-page space. */}
        {((posts.status === 'ready' && posts.posts.length > 0) || savedItems.length > 0) && <aside className={styles.side} aria-label="Scene activity">
          <div className={styles.sideIntro}><span className={styles.sideNumber}>↗</span><div><span className={styles.sideKicker}>SOURCE CHECK</span><h3>{featured?.event.city ?? 'The world'} <em>on X.</em></h3><p>Public posts appear only when the X connection has checked this event recently. Posts open at the source.</p></div></div>
          <div className={styles.postPanel} aria-live="polite">
            <div className={styles.postHead}><span>PUBLIC POSTS · X</span><span className={posts.status === 'ready' && posts.fetchedAt ? styles.sourceDot : styles.sourceIdle} aria-hidden="true" /></div>
            {posts.status === 'loading' && <p className={styles.postEmpty}>Looking for the latest stored source check…</p>}
            {posts.status === 'error' && <p className={styles.postEmpty}>Public posts are temporarily unavailable.</p>}
            {posts.status === 'ready' && !posts.fetchedAt && <p className={styles.postEmpty}>No recent X source check is available for this scene. Explore the editorial ideas alongside.</p>}
            {posts.status === 'ready' && posts.fetchedAt && posts.posts.length === 0 && <p className={styles.postEmpty}>The latest source check found no matching public posts for this scene.</p>}
            {posts.status === 'ready' && posts.posts.slice(0, 3).map((post) => {
              if (!/^https:\/\/x\.com\/[A-Za-z0-9_]+\/status\/\d+$/.test(post.url)) return null;
              return <a className={styles.post} key={post.id} href={post.url} target="_blank" rel="noopener noreferrer">
                <span className={styles.postAuthor}>{post.author} <span>@{post.handle}</span></span>
                <span className={styles.postText}>{post.text}</span>
                <span className={styles.postTime}>{new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · View on X ↗</span>
              </a>;
            })}
            {posts.status === 'ready' && posts.fetchedAt && <p className={styles.fetched}>Source checked {new Date(posts.fetchedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · Posts are public, not dope.travel endorsements.</p>}
          </div>
          <div className={styles.savedPanel}><span className={styles.sideKicker}>YOUR TRAIL</span><h3>Keep the good ones close.</h3><p>Saved ideas stay on this device.</p>
            {savedItems.length > 0 && <ul>{savedItems.slice(-4).reverse().map((item) => <li key={item.id}><Link href={item.href}>{item.label} <span aria-hidden="true">↗</span></Link></li>)}</ul>}
            {savedItems.length === 0 && <span className={styles.saveHint}>Tap “Save idea” on a scene to begin.</span>}
          </div>
        </aside>}
      </div>
    </section>
  );
}
