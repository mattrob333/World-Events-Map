import { createHash } from 'node:crypto';
import type { DecisionReceipt, JevResult } from '@/lib/jev/client';
import { FEED_ITEM_CONTRACT, feedItemQuestions, feedItemState, routeFeedItem, type FeedItemAnswers } from '@/lib/jev/contracts/feedItem';
import { parseFeed, type FeedEntry } from './parse';
import type { LibrarySource } from './library';

/** Items older than this are not news for the daily intake. */
export const MAX_AGE_HOURS = 72;
/** Newest items kept per source per run, so one prolific feed can't flood the pool. */
export const PER_SOURCE_CAP = 3;
/** Jev screenings per run. Cost is tiny, but the cap is code's job, not the model's. */
export const JEV_PER_RUN = 80;

export type FeedRow = {
  id: string;
  source_name: string;
  source_feed: string;
  source_tier: 'A' | 'B' | 'C';
  source_trip_types: string[];
  source_regions: string[];
  url: string;
  title: string;
  excerpt: string;
  published_at: string;
  fetched_at: string;
  contract: string | null;
  jev_route: 'reject' | 'review' | 'personal' | 'public' | 'unscored';
  jev_trip_type: string | null;
  jev_region: string | null;
  jev_relevance: number | null;
  jev_newsworthy: number | null;
};

export type IntakeDeps = {
  now: Date;
  /** Fetches a feed body; returns null on any failure. */
  fetchText: (url: string) => Promise<string | null>;
  /** One batched Jev call for one item's state. */
  ask: (state: ReturnType<typeof feedItemState>) => Promise<JevResult<typeof feedItemQuestions>>;
  /** Ids already stored, so a story is screened once. */
  known: (ids: string[]) => Promise<Set<string>>;
  concurrency?: number;
  jevPerRun?: number;
};

export type IntakeResult = {
  rows: FeedRow[];
  receipts: DecisionReceipt[];
  counts: { sources: number; fetched: number; failedSources: number; fresh: number; screened: number; routes: Record<string, number> };
};

export const itemId = (url: string) => createHash('sha256').update(url.replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase()).digest('hex').slice(0, 24);

async function pool<T, R>(items: T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      out[index] = await work(items[index]!);
    }
  }));
  return out;
}

const TIER_RANK = { A: 0, B: 1, C: 2 } as const;

/**
 * The daily intake. Deterministic code fetches, filters and caps; Jev screens
 * each new story once under feed-item@1; code picks the route. In shadow mode
 * the caller stores rows and receipts but shows nothing on the route yet.
 */
export async function runFeedIntake(sources: LibrarySource[], deps: IntakeDeps): Promise<IntakeResult> {
  const nowMs = deps.now.getTime();
  const fetchedAt = deps.now.toISOString();
  const readable = sources.filter((source) => !source.signalOnly);
  let failedSources = 0;
  let fetched = 0;

  const perSource = await pool(readable, deps.concurrency ?? 8, async (source) => {
    const body = await deps.fetchText(source.feedUrl);
    if (!body) {
      failedSources += 1;
      return [] as { source: LibrarySource; entry: FeedEntry & { publishedAt: string } }[];
    }
    const entries = parseFeed(body);
    fetched += entries.length;
    return entries
      .filter((entry): entry is FeedEntry & { publishedAt: string } => {
        if (!entry.publishedAt) return false;
        const age = nowMs - Date.parse(entry.publishedAt);
        return age >= -60 * 60_000 && age <= MAX_AGE_HOURS * 3_600_000;
      })
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, PER_SOURCE_CAP)
      .map((entry) => ({ source, entry }));
  });

  // Dedupe by normalized URL and by exact title across sources.
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();
  const fresh = perSource.flat().filter(({ entry }) => {
    const id = itemId(entry.url);
    const title = entry.title.toLowerCase().replace(/\W+/g, ' ').trim();
    if (seenIds.has(id) || seenTitles.has(title)) return false;
    seenIds.add(id);
    seenTitles.add(title);
    return true;
  });

  const known = await deps.known(fresh.map(({ entry }) => itemId(entry.url)));
  const unseen = fresh
    .filter(({ entry }) => !known.has(itemId(entry.url)))
    .sort((a, b) => TIER_RANK[a.source.tier] - TIER_RANK[b.source.tier] || b.entry.publishedAt.localeCompare(a.entry.publishedAt));

  const budget = Math.max(0, Math.min(JEV_PER_RUN, deps.jevPerRun ?? JEV_PER_RUN));
  const rows: FeedRow[] = [];
  const receipts: DecisionReceipt[] = [];
  const routes: Record<string, number> = {};

  await pool(unseen, 4, async ({ source, entry }) => {
    const id = itemId(entry.url);
    const base: FeedRow = {
      id, source_name: source.name, source_feed: source.feedUrl, source_tier: source.tier,
      source_trip_types: source.tripTypes, source_regions: source.regions,
      url: entry.url, title: entry.title, excerpt: entry.excerpt, published_at: entry.publishedAt, fetched_at: fetchedAt,
      contract: null, jev_route: 'unscored', jev_trip_type: null, jev_region: null, jev_relevance: null, jev_newsworthy: null,
    };
    const index = unseen.findIndex((candidate) => candidate.entry === entry);
    if (index >= budget) {
      rows.push(base);
      routes.unscored = (routes.unscored ?? 0) + 1;
      return;
    }
    const state = feedItemState({
      title: entry.title, excerpt: entry.excerpt, publisher: source.name, publisherKind: source.kind,
      publisherTripTypes: source.tripTypes, publisherRegions: source.regions, publishedAt: entry.publishedAt,
    });
    const result = await deps.ask(state);
    const decided = result.ok ? routeFeedItem(result.answers as FeedItemAnswers) : { route: 'review' as const, why: `jev ${result.failure}` };
    routes[decided.route] = (routes[decided.route] ?? 0) + 1;
    receipts.push({
      contract: FEED_ITEM_CONTRACT,
      subject: id,
      stateHash: createHash('sha256').update(JSON.stringify(state)).digest('hex').slice(0, 32),
      model: result.ok ? result.model : null,
      latencyMs: result.latencyMs,
      answers: result.ok ? (result.answers as unknown as DecisionReceipt['answers']) : null,
      failure: result.ok ? null : result.failure,
      route: decided.route,
      actionTaken: false,
      createdAt: fetchedAt,
    });
    rows.push({
      ...base,
      contract: FEED_ITEM_CONTRACT,
      jev_route: decided.route,
      jev_trip_type: result.ok ? result.answers.trip_type.selected : null,
      jev_region: result.ok ? result.answers.region.selected : null,
      jev_relevance: result.ok ? result.answers.travel_relevance.p : null,
      jev_newsworthy: result.ok ? result.answers.newsworthy.score : null,
    });
  });

  return {
    rows: rows.sort((a, b) => b.published_at.localeCompare(a.published_at)),
    receipts,
    counts: { sources: readable.length, fetched, failedSources, fresh: fresh.length, screened: receipts.length, routes },
  };
}
