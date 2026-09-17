import 'server-only';
import { getJSON } from './adapters/http';
import { buildQuery } from './adapters/x';
import { signalDatabase } from './durable';
import type { WorldEvent } from '@/lib/types';

export interface ScenePost {
  id: string;
  text: string;
  author: string;
  handle: string;
  createdAt: string;
  url: string;
}
interface SearchResponse {
  errors?: unknown[];
  data?: { id: string; text: string; author_id: string; created_at: string }[];
  includes?: { users?: { id: string; name: string; username: string }[] };
}

/** Explicit opt-in; only invoked by the authorized, globally leased scheduler. */
export async function refreshScenePosts(event: WorldEvent) {
  const token = process.env.X_BEARER_TOKEN;
  const db = signalDatabase();
  if (!token || process.env.X_POSTS_ENABLED !== '1' || !db) return;
  const query = new URLSearchParams({
    query: buildQuery(event),
    max_results: '10',
    'tweet.fields': 'created_at,author_id',
    expansions: 'author_id',
    'user.fields': 'name,username',
  });
  const result = await getJSON<SearchResponse>(
    `https://api.x.com/2/tweets/search/recent?${query}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (result.errors?.length) throw new Error('X rejected the scene query');
  const users = new Map(
    (result.includes?.users ?? []).map((user) => [user.id, user]),
  );
  const posts: ScenePost[] = (result.data ?? []).flatMap((post) => {
    const author = users.get(post.author_id);
    if (
      !author ||
      !/^[a-zA-Z0-9_]+$/.test(author.username) ||
      !/^\d+$/.test(post.id)
    )
      return [];
    return [
      {
        id: post.id,
        text: post.text,
        author: author.name,
        handle: author.username,
        createdAt: post.created_at,
        url: `https://x.com/${author.username}/status/${post.id}`,
      },
    ];
  });
  const { error } = await db
    .from('meridian_scene_posts')
    .upsert({
      event_id: event.id,
      posts,
      fetched_at: new Date().toISOString(),
    });
  if (error) throw new Error('Social feed persistence failed');
}

export async function readScenePosts(
  eventId: string,
): Promise<{ posts: ScenePost[]; fetchedAt: string | null }> {
  const db = signalDatabase();
  if (!db || process.env.X_POSTS_ENABLED !== '1')
    return { posts: [], fetchedAt: null };
  const { data, error } = await db
    .from('meridian_scene_posts')
    .select('posts,fetched_at')
    .eq('event_id', eventId)
    .gte('fetched_at', new Date(Date.now() - 15 * 60_000).toISOString())
    .maybeSingle();
  if (error) throw new Error('Social feed unavailable');
  return { posts: data?.posts ?? [], fetchedAt: data?.fetched_at ?? null };
}
