import { describe, expect, it, vi } from 'vitest';
import type { JevResult } from '@/lib/jev/client';
import type { feedItemQuestions } from '@/lib/jev/contracts/feedItem';
import { JEV_PER_RUN, PER_SOURCE_CAP, itemId, runFeedIntake } from './intake';
import type { LibrarySource } from './library';

vi.mock('server-only', () => ({}));

const now = new Date('2026-09-24T12:00:00Z');
const source = (name: string, tier: 'A' | 'B' | 'C' = 'A', signalOnly = false): LibrarySource => ({
  name, feedUrl: `https://${name}.example/feed`, siteUrl: `https://${name}.example`, tier, kind: 'magazine', tripTypes: ['city'], regions: ['global'], signalOnly, needsFilter: false,
});
const rss = (items: { title: string; url: string; hoursAgo: number }[]) =>
  `<rss><channel>${items.map((item) => `<item><title>${item.title}</title><link>${item.url}</link><pubDate>${new Date(now.getTime() - item.hoursAgo * 3_600_000).toUTCString()}</pubDate><description>About ${item.title}</description></item>`).join('')}</channel></rss>`;

const answers = (relevance: number, pitch = 0.05) => ({
  travel_relevance: { type: 'noul', p: relevance },
  trip_type: { type: 'choice', selected: 'food', probabilities: { food: 0.8, none: 0.2 }, confidence: 0.8 },
  region: { type: 'choice', selected: 'japan', probabilities: { japan: 0.9, unclear: 0.1 }, confidence: 0.9 },
  newsworthy: { type: 'score', score: 2.4, levels: 4, probabilities: [0, 0.1, 0.4, 0.5], confidence: 0.8 },
  sales_pitch: { type: 'noul', p: pitch },
  risky_instructions: { type: 'noul', p: 0.01 },
});

describe('feed intake', () => {
  it('filters stale items, caps per source, dedupes, skips known ids and signal-only sources', async () => {
    const feeds: Record<string, string> = {
      'https://a.example/feed': rss([
        { title: 'Tokyo opening', url: 'https://a.example/1', hoursAgo: 2 },
        { title: 'Two', url: 'https://a.example/2', hoursAgo: 3 },
        { title: 'Three', url: 'https://a.example/3', hoursAgo: 4 },
        { title: 'Four', url: 'https://a.example/4', hoursAgo: 5 },
        { title: 'Old', url: 'https://a.example/old', hoursAgo: 100 },
      ]),
      'https://b.example/feed': rss([
        { title: 'Tokyo opening', url: 'https://b.example/dup-title', hoursAgo: 1 },
        { title: 'Known', url: 'https://b.example/known', hoursAgo: 1 },
      ]),
    };
    const ask = vi.fn(async (): Promise<JevResult<typeof feedItemQuestions>> => ({ ok: true, answers: answers(0.9) as never, model: 'jev-latest', latencyMs: 120 }));
    const result = await runFeedIntake([source('a'), source('b'), source('forum', 'B', true), source('dead')], {
      now,
      fetchText: async (url) => feeds[url] ?? null,
      ask,
      known: async () => new Set([itemId('https://b.example/known')]),
    });
    expect(result.counts.sources).toBe(3);
    expect(result.counts.failedSources).toBe(1);
    const urls = result.rows.map((row) => row.url);
    expect(urls.filter((url) => url.startsWith('https://a.example/'))).toHaveLength(PER_SOURCE_CAP);
    expect(urls).not.toContain('https://a.example/old');
    expect(urls).not.toContain('https://b.example/known');
    // Same title from two sources is one story.
    expect(result.rows.filter((row) => row.title === 'Tokyo opening')).toHaveLength(1);
    expect(result.receipts.every((receipt) => receipt.actionTaken === false && receipt.contract === 'feed-item@1')).toBe(true);
    expect(result.rows.every((row) => row.jev_route === 'public')).toBe(true);
    expect(result.rows[0]!.jev_region).toBe('japan');
  });

  it('routes by code thresholds and records failures as review, never as a pass', async () => {
    const feed = rss([
      { title: 'Pitch', url: 'https://a.example/p', hoursAgo: 1 },
      { title: 'Broken', url: 'https://a.example/b', hoursAgo: 2 },
    ]);
    const result = await runFeedIntake([source('a')], {
      now,
      fetchText: async () => feed,
      ask: async (state) => state.title === 'Pitch'
        ? { ok: true, answers: answers(0.9, 0.8) as never, model: 'jev-latest', latencyMs: 90 }
        : { ok: false, failure: 'timeout', latencyMs: 10000 },
      known: async () => new Set(),
    });
    const byTitle = Object.fromEntries(result.rows.map((row) => [row.title, row.jev_route]));
    expect(byTitle).toEqual({ Pitch: 'review', Broken: 'review' });
    expect(result.receipts.find((receipt) => receipt.failure === 'timeout')?.answers).toBeNull();
  });

  it('never screens more than the per-run budget', async () => {
    const sources = Array.from({ length: 40 }, (_, i) => source(`s${i}`));
    const ask = vi.fn(async (): Promise<JevResult<typeof feedItemQuestions>> => ({ ok: true, answers: answers(0.9) as never, model: 'jev-latest', latencyMs: 1 }));
    const result = await runFeedIntake(sources, {
      now,
      fetchText: async (url) => rss(Array.from({ length: 3 }, (_, i) => ({ title: `${url} story ${i}`, url: `${url}/${i}`, hoursAgo: 1 }))),
      ask,
      known: async () => new Set(),
    });
    expect(ask).toHaveBeenCalledTimes(JEV_PER_RUN);
    expect(result.counts.routes.unscored).toBe(120 - JEV_PER_RUN);
  });

  it('keeps only travel-ish stories from general-news feeds', async () => {
    const feed = rss([
      { title: 'City council budget vote', url: 'https://n.example/1', hoursAgo: 1 },
      { title: 'New rooftop restaurant opens downtown', url: 'https://n.example/2', hoursAgo: 1 },
    ]);
    const result = await runFeedIntake([{ ...source('n'), needsFilter: true }], {
      now,
      fetchText: async () => feed,
      ask: async () => ({ ok: false, failure: 'unconfigured', latencyMs: 0 }),
      known: async () => new Set(),
    });
    expect(result.rows.map((row) => row.title)).toEqual(['New rooftop restaurant opens downtown']);
  });
});
