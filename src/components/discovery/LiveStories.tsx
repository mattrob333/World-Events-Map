'use client';

import { useEffect, useState } from 'react';
import type { LatestStory } from '@/lib/vibe/latestStories';
import styles from './live-stories.module.css';
import { SourceLogo } from '@/components/brand/SourceLogo';

function ago(iso: string, now: number): string {
  const hours = Math.max(0, Math.round((now - Date.parse(iso)) / 3_600_000));
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

/**
 * Fresh from the nightly news intake: headlines that name a place on our
 * calendar, over a photo of that place. Each opens the publisher. Shows
 * nothing at all until there are stories, so it never sits empty on home.
 */
export function LiveStories() {
  const [stories, setStories] = useState<LatestStory[]>([]);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/feed/latest', { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<{ stories?: LatestStory[] }>) : { stories: [] }))
      .then((body) => {
        setNow(Date.now());
        setStories(Array.isArray(body.stories) ? body.stories : []);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  if (stories.length < 2) return null;
  return (
    <section className={styles.live} aria-labelledby="live-stories-title">
      <div className={styles.head}>
        <span className={styles.kicker}><i aria-hidden="true" /> LIVE · IN THE NEWS</span>
        <h2 id="live-stories-title">What the world is saying.</h2>
      </div>
      <div className={styles.rail} role="list">
        {stories.map((story) => (
          <a key={story.url} role="listitem" className={styles.card} href={story.url} target="_blank" rel="noopener noreferrer">
            {story.photo ? (
              // Local editorial photos, reviewed and credited in the photo ledger.
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.photo} src={story.photo.imageUrl} alt="" loading="lazy" decoding="async" />
            ) : null}
            <span className={styles.top}>
              <strong>{story.place.name}</strong>
              <span>{now ? ago(story.publishedAt, now) : ''}</span>
            </span>
            <span className={styles.title}>{story.title}</span>
            <span className={styles.source}><SourceLogo source={story.url} size={12} className="mr-1" />{story.source} <span aria-hidden="true">↗</span></span>
          </a>
        ))}
      </div>
      <p className={styles.note}>Headlines link to their publishers. Photos show the place, not the story.</p>
    </section>
  );
}
