'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import styles from './research-pulse.module.css';

type ResearchCategory = 'article' | 'social' | 'deal' | 'flight';

type ResearchItem = {
  id: string;
  title: string;
  excerpt: string;
  url: string;
  source: string;
  platform: string;
  category: ResearchCategory;
  topic: string;
  destinationSlug: string | null;
  publishedAt: string;
  fetchedAt: string;
  author?: string;
};

type FeedStatus = 'loading' | 'live' | 'unconfigured' | 'error';
type RunStatus = 'complete' | 'partial' | 'error' | 'running' | 'awaiting';
type FeedState = { key: string; status: FeedStatus; lastRunStatus: RunStatus; generatedAt: string | null; items: ResearchItem[] };

const initialState: FeedState = { key: '', status: 'loading', lastRunStatus: 'awaiting', generatedAt: null, items: [] };

function safeSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function sourceDate(value: string | null, includeTime = false): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' } : {}),
  });
}

function SourceItem({ item, variant }: { item: ResearchItem; variant: 'article' | 'social' | 'offer' }) {
  const href = safeSourceUrl(item.url);
  if (!href) return null;
  const published = sourceDate(item.publishedAt);
  const checked = sourceDate(item.fetchedAt, true);

  return (
    <article className={`${styles.item} ${styles[variant]}`}>
      <div className={styles.itemTop}>
        <span className={styles.itemType}>{item.category === 'flight' ? 'FLIGHT' : item.category.toUpperCase()}</span>
        {item.topic && <span className={styles.topic}>{item.topic}</span>}
      </div>
      <h4><a href={href} target="_blank" rel="noopener noreferrer">{item.title}<span aria-hidden="true">↗</span><span className={styles.srOnly}> (opens source in a new tab)</span></a></h4>
      {item.excerpt && <p className={styles.excerpt}>{item.excerpt}</p>}
      <div className={styles.itemFoot}>
        <span>{item.source}{item.platform && item.platform !== item.source ? ` · ${item.platform}` : ''}{item.author ? ` · ${item.author}` : ''}</span>
        <span>{published ? `Published ${published}` : 'Publication date unavailable'}{checked ? ` · Checked ${checked}` : ''}</span>
      </div>
    </article>
  );
}

function EmptyLane({ kind }: { kind: 'articles' | 'social' | 'offers' }) {
  const fallback = kind === 'offers' ? '/trips' : '/#world-map';
  const label = kind === 'offers' ? 'Start a trip plan' : 'Explore curated places';
  const message = kind === 'articles'
    ? 'Awaiting current, source-dated travel stories from the next research sweep.'
    : kind === 'social'
      ? 'Awaiting recent public posts with source links and timestamps.'
      : 'Awaiting verified deals and flights. No prices or seats to show yet.';
  return <div className={styles.emptyLane}>
    <span className={styles.emptyMark} aria-hidden="true">◇</span>
    <p>{message}</p>
    <Link href={fallback}>{label} <span aria-hidden="true">↗</span></Link>
  </div>;
}

export function ResearchPulse({ destinationSlug }: { destinationSlug?: string }) {
  const key = destinationSlug ?? 'world';
  const [state, setState] = useState<FeedState>(initialState);

  useEffect(() => {
    const controller = new AbortController();
    const endpoint = destinationSlug
      ? `/api/research-feed?destination=${encodeURIComponent(destinationSlug)}`
      : '/api/research-feed';
    async function load() {
      try {
        const response = await fetch(endpoint, { signal: controller.signal });
        if (!response.ok) throw new Error('Research feed unavailable');
        const payload: { status?: FeedStatus; lastRunStatus?: RunStatus; generatedAt?: string; items?: ResearchItem[] } = await response.json();
        if (controller.signal.aborted) return;
        const status = payload.status === 'live' || payload.status === 'unconfigured' ? payload.status : 'error';
        const items = status === 'live' && Array.isArray(payload.items)
          ? payload.items.filter((item) => item && typeof item.url === 'string' && safeSourceUrl(item.url)
            && ['article', 'social', 'deal', 'flight'].includes(item.category))
          : [];
        const lastRunStatus = ['complete', 'partial', 'error', 'running'].includes(payload.lastRunStatus ?? '')
          ? payload.lastRunStatus! : 'awaiting';
        setState({ key, status, lastRunStatus, generatedAt: payload.generatedAt ?? null, items });
      } catch {
        if (!controller.signal.aborted) setState({ key, status: 'error', lastRunStatus: 'error', generatedAt: null, items: [] });
      }
    }

    void load();
    return () => controller.abort();
  }, [destinationSlug, key]);

  const feed = state.key === key ? state : initialState;
  const articles = feed.items.filter((item) => item.category === 'article');
  const social = feed.items.filter((item) => item.category === 'social');
  const offers = feed.items.filter((item) => item.category === 'deal' || item.category === 'flight');
  const hasItems = feed.items.length > 0;
  const checked = sourceDate(feed.generatedAt, true);
  const sweepState = feed.lastRunStatus === 'error' ? 'Latest sweep failed'
    : feed.lastRunStatus === 'partial' ? 'Partial sweep'
      : feed.lastRunStatus === 'running' ? 'Sweep in progress' : null;

  return (
    <section className={styles.pulse} aria-labelledby="research-pulse-title">
      <div className={styles.heading}>
        <div>
          <span className={styles.kicker}><span aria-hidden="true">✳</span> THE RESEARCH PULSE</span>
          <h2 id="research-pulse-title">In the <em>conversation.</em></h2>
          <p>Dated travel stories and public social posts, screened for relevance. Open any find to inspect its original source.</p>
        </div>
        <div className={styles.checkState} aria-live="polite">
          {feed.status === 'loading' && 'Checking the stored research feed…'}
          {feed.status === 'live' && hasItems && (sweepState
            ? `${sweepState}${checked ? ` · last completed ${checked}` : ''}`
            : checked ? `Last research sweep · ${checked}` : 'Source-linked research')}
          {feed.status === 'live' && !hasItems && (sweepState
            ? `${sweepState}${checked ? ` · last completed ${checked}` : ''}`
            : checked ? `No qualifying results · last sweep ${checked}` : 'First research sweep awaiting setup')}
          {feed.status === 'unconfigured' && 'Research sources awaiting setup'}
          {feed.status === 'error' && 'Research feed temporarily unavailable'}
        </div>
      </div>

      <div className={styles.lanes}>
        <div className={`${styles.lane} ${styles.articleLane}`}>
          <div className={styles.laneHeading}><div><span>01 / THE READ</span><h3>Stories worth the detour.</h3></div><span aria-hidden="true">↗</span></div>
          {articles.length ? <div className={styles.itemStack}>{articles.map((item) => <SourceItem key={item.id} item={item} variant="article" />)}</div> : <EmptyLane kind="articles" />}
        </div>
        <div className={`${styles.lane} ${styles.socialLane}`}>
          <div className={styles.laneHeading}><div><span>02 / THE CHATTER</span><h3>Social &amp; hashtags.</h3></div><span aria-hidden="true">#</span></div>
          {social.length ? <div className={styles.itemStack}>{social.map((item) => <SourceItem key={item.id} item={item} variant="social" />)}</div> : <EmptyLane kind="social" />}
        </div>
        <div className={`${styles.lane} ${styles.offerLane}`}>
          <div className={styles.laneHeading}><div><span>03 / THE OPENING</span><h3>Deals &amp; flights.</h3></div><span aria-hidden="true">✈</span></div>
          {offers.length ? <div className={styles.itemStack}>{offers.map((item) => <SourceItem key={item.id} item={item} variant="offer" />)}</div> : <EmptyLane kind="offers" />}
        </div>
      </div>
      <p className={styles.disclaimer}>Source material is reported by third parties. Availability and terms should be checked with the original provider.</p>
    </section>
  );
}
