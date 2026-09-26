'use client';

import { useEffect, useMemo, useState } from 'react';
import { SourceLogo } from '@/components/brand/SourceLogo';
import { LANE_ORDER, LANES, type LaneKey, type SmarterStory } from '@/lib/smarter/lanes';
import { TOOLKIT } from '@/lib/smarter/toolkit';
import styles from './travel-smarter.module.css';

function ago(iso: string, now: number): string {
  const hours = Math.max(0, Math.round((now - Date.parse(iso)) / 3_600_000));
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

/** "All" takes the newest story from each lane in turn, so no one lane floods it. */
function mixed(stories: readonly SmarterStory[]): SmarterStory[] {
  const byLane = LANE_ORDER.map((key) => stories.filter((story) => story.lane === key));
  const out: SmarterStory[] = [];
  for (let round = 0; out.length < 7 && byLane.some((list) => list.length > round); round += 1) {
    for (const list of byLane) if (list[round] && out.length < 7) out.push(list[round]);
  }
  return out;
}

const laneOf = (key: LaneKey) => LANES.find((lane) => lane.key === key)!;

/**
 * Travel smarter: this week's points plays, lounge intel, fare deals, gear and
 * new stays, from the blogs and magazines people who travel a lot read. Each
 * opens the publisher. The toolkit below is the standing kit: real tools, no
 * prices, no affiliate links. Hidden until there's enough to be worth a look.
 */
export function TravelSmarter() {
  const [stories, setStories] = useState<SmarterStory[]>([]);
  const [now, setNow] = useState(0);
  const [lane, setLane] = useState<LaneKey | 'all'>('all');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/feed/smarter', { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<{ stories?: SmarterStory[] }>) : { stories: [] }))
      .then((body) => {
        setNow(Date.now());
        setStories(Array.isArray(body.stories) ? body.stories : []);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const lanes = useMemo(() => LANE_ORDER.map(laneOf).filter((entry) => stories.some((story) => story.lane === entry.key)), [stories]);
  const shown = useMemo(() => (lane === 'all' ? mixed(stories) : stories.filter((story) => story.lane === lane).slice(0, 7)), [lane, stories]);
  if (stories.length < 4) return null;
  const [lead, ...rest] = shown;

  return (
    <section className={styles.smarter} aria-labelledby="travel-smarter-title">
      <div className={styles.head}>
        <span className={styles.kicker}>TRAVEL SMARTER · THIS WEEK</span>
        <h2 id="travel-smarter-title">Go further for less.</h2>
        <p>Points plays, lounge intel, fare drops, gear worth packing and new places to stay, from the people who travel for a living.</p>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Topics">
        {[{ key: 'all' as const, label: 'Top picks', emoji: '✦' }, ...lanes].map((entry) => (
          <button
            key={entry.key}
            type="button"
            role="tab"
            aria-selected={lane === entry.key}
            className={styles.tab}
            onClick={() => setLane(entry.key)}
          >
            <span aria-hidden="true">{entry.emoji}</span> {entry.label}
          </button>
        ))}
      </div>

      {lead && (
        <div className={styles.grid} role="tabpanel" aria-label={lane === 'all' ? 'Top picks' : laneOf(lane).label}>
          <a className={styles.lead} data-lane={lead.lane} href={lead.url} target="_blank" rel="noopener noreferrer">
            <span className={styles.chip}><span aria-hidden="true">{laneOf(lead.lane).emoji}</span> {laneOf(lead.lane).label}</span>
            <span className={styles.leadTitle}>{lead.title}</span>
            {lead.excerpt && <span className={styles.excerpt}>{lead.excerpt}</span>}
            <span className={styles.byline}><SourceLogo source={lead.source} size={14} />{lead.source}<span className={styles.when}>{now ? ago(lead.publishedAt, now) : ''}</span><span aria-hidden="true">↗</span></span>
          </a>
          <ol className={styles.list}>
            {rest.map((story) => (
              <li key={story.url}>
                <a className={styles.row} href={story.url} target="_blank" rel="noopener noreferrer">
                  <span className={styles.rowLane} data-lane={story.lane} aria-label={laneOf(story.lane).label}>{laneOf(story.lane).emoji}</span>
                  <span className={styles.rowBody}>
                    <span className={styles.rowTitle}>{story.title}</span>
                    <span className={styles.rowMeta}><SourceLogo source={story.source} size={12} />{story.source} · {now ? ago(story.publishedAt, now) : ''}</span>
                  </span>
                  <span className={styles.arrow} aria-hidden="true">↗</span>
                </a>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className={styles.kit}>
        <p className={styles.kitHead}>The toolkit</p>
        <ul className={styles.kitRail}>
          {TOOLKIT.map((tool) => (
            <li key={tool.name}>
              <a className={styles.tool} href={tool.url} target="_blank" rel="noopener noreferrer">
                <span className={styles.toolName}><SourceLogo source={tool.url} size={14} />{tool.name}</span>
                <span className={styles.toolWhat}>{tool.what}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      <p className={styles.note}>Headlines link to their publishers. Offers and bonuses change fast, so check the terms there before you act.</p>
    </section>
  );
}
