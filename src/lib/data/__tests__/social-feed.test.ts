import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EVENTS } from '../events';

vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ getJSON: vi.fn(), signalDatabase: vi.fn(), buildQuery: vi.fn() }));
vi.mock('../adapters/http', () => ({ getJSON: mocks.getJSON }));
vi.mock('../adapters/x', () => ({ buildQuery: mocks.buildQuery }));
vi.mock('../durable', () => ({ signalDatabase: mocks.signalDatabase }));
import { readScenePosts, refreshScenePosts } from '../social-feed';

const event = EVENTS[0];
const now = '2026-09-17T12:00:00.000Z';
const post = { id: '123456789', text: 'An unforgettable evening.', author_id: 'author-1', created_at: '2026-09-17T11:58:00.000Z' };

function database() {
  const chain = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
  };
  const db = { from: vi.fn(() => chain) };
  mocks.signalDatabase.mockReturnValue(db);
  return { db, chain };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers(); vi.setSystemTime(new Date(now));
  vi.stubEnv('X_BEARER_TOKEN', 'test-token-not-a-real-secret'); vi.stubEnv('X_POSTS_ENABLED', '1');
  mocks.buildQuery.mockReturnValue('"Our event" -is:retweet');
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('scene post refresh', () => {
  it('rejects an HTTP-200 errors payload without replacing the stored feed', async () => {
    const { db, chain } = database();
    mocks.getJSON.mockResolvedValue({ errors: [{ detail: 'Query rejected' }], data: [post] });
    await expect(refreshScenePosts(event)).rejects.toThrow('X rejected the scene query');
    expect(db.from).not.toHaveBeenCalled(); expect(chain.upsert).not.toHaveBeenCalled();
  });

  it('maps author expansions to attributed canonical post links and persists the event snapshot', async () => {
    const { chain } = database();
    mocks.getJSON.mockResolvedValue({ data: [post], includes: { users: [{ id: 'author-1', name: 'A Travel Writer', username: 'scene_writer' }] } });
    await refreshScenePosts(event);
    const [url, options] = mocks.getJSON.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://api.x.com/2/tweets/search/recent');
    expect(parsed.searchParams.get('query')).toBe('"Our event" -is:retweet');
    expect(parsed.searchParams.get('expansions')).toBe('author_id');
    expect(options.headers.Authorization).toBe('Bearer test-token-not-a-real-secret');
    expect(chain.upsert).toHaveBeenCalledWith({ event_id: event.id, fetched_at: now, posts: [{ id: post.id, text: post.text, author: 'A Travel Writer', handle: 'scene_writer', createdAt: post.created_at, url: 'https://x.com/scene_writer/status/123456789' }] });
  });

  it('does not create links for missing authors or unsafe IDs and handles', async () => {
    const { chain } = database();
    mocks.getJSON.mockResolvedValue({ data: [post, { ...post, id: '../bad', author_id: 'ok' }, { ...post, id: '321', author_id: 'unsafe' }], includes: { users: [{ id: 'ok', name: 'Okay', username: 'okay' }, { id: 'unsafe', name: 'Unsafe', username: 'bad/handle' }] } });
    await refreshScenePosts(event);
    expect(chain.upsert).toHaveBeenCalledWith({ event_id: event.id, fetched_at: now, posts: [] });
  });

  it.each(['token', 'opt-in', 'database'])('makes no upstream request without %s configuration', async missing => {
    const { chain } = database();
    if (missing === 'token') vi.stubEnv('X_BEARER_TOKEN', '');
    if (missing === 'opt-in') vi.stubEnv('X_POSTS_ENABLED', '0');
    if (missing === 'database') mocks.signalDatabase.mockReturnValue(null);
    await refreshScenePosts(event);
    expect(mocks.getJSON).not.toHaveBeenCalled(); expect(chain.upsert).not.toHaveBeenCalled();
  });

  it('reports persistence errors rather than claiming a refreshed feed', async () => {
    const { chain } = database();
    mocks.getJSON.mockResolvedValue({ data: [] }); chain.upsert.mockResolvedValue({ error: { message: 'unavailable' } });
    await expect(refreshScenePosts(event)).rejects.toThrow('Social feed persistence failed');
  });
});

describe('cached scene reads', () => {
  it('applies an event filter and fifteen-minute freshness cutoff without calling X', async () => {
    const { db, chain } = database();
    chain.maybeSingle.mockResolvedValue({ data: { posts: [{ id: '42' }], fetched_at: now }, error: null });
    expect(await readScenePosts(event.id)).toEqual({ posts: [{ id: '42' }], fetchedAt: now });
    expect(db.from).toHaveBeenCalledWith('meridian_scene_posts');
    expect(chain.eq).toHaveBeenCalledWith('event_id', event.id);
    expect(chain.gte).toHaveBeenCalledWith('fetched_at', '2026-09-17T11:45:00.000Z');
    expect(mocks.getJSON).not.toHaveBeenCalled();
  });

  it('returns an empty feed for no fresh snapshot and for disabled social posts', async () => {
    const { db } = database();
    expect(await readScenePosts(event.id)).toEqual({ posts: [], fetchedAt: null });
    db.from.mockClear(); vi.stubEnv('X_POSTS_ENABLED', '0');
    expect(await readScenePosts(event.id)).toEqual({ posts: [], fetchedAt: null });
    expect(db.from).not.toHaveBeenCalled();
  });

  it('does not expose underlying database errors to the feed consumer', async () => {
    const { chain } = database();
    chain.maybeSingle.mockResolvedValue({ data: null, error: { message: 'internal database details' } });
    await expect(readScenePosts(event.id)).rejects.toThrow('Social feed unavailable');
  });
});
