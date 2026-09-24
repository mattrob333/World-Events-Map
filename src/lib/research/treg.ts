import 'server-only';

import { createHash } from 'node:crypto';
import { tregCall, type TregCallReceipt } from './tregClient';

export type TregSearchTask =
  | { kind: 'instagram_hashtag'; term: string; destinationSlug?: string }
  | { kind: 'tiktok_search'; term: string; destinationSlug?: string };

export interface TregResearchCandidate {
  source: 'treg';
  platform: 'Instagram' | 'TikTok';
  category: 'social';
  topic: 'social';
  title: string;
  summary: string;
  url: string;
  publishedAt: string | null;
  fetchedAt: string;
  author: string | null;
  query: string;
  destinationSlug?: string;
}

export type { TregCallReceipt };

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : null;
const string = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

function postDate(value: unknown): string | null {
  const millis = typeof value === 'number' && Number.isFinite(value) ? value * 1000 : NaN;
  if (millis < Date.UTC(2020, 0, 1) || millis > Date.now() + 60 * 60_000) return null;
  return Number.isFinite(millis) ? new Date(millis).toISOString() : null;
}

function validSocialUrl(value: unknown, platform: 'Instagram' | 'TikTok'): string | null {
  const raw = string(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:') return null;
    if (platform === 'Instagram' && host !== 'www.instagram.com' && host !== 'instagram.com') return null;
    if (platform === 'TikTok' && host !== 'www.tiktok.com' && host !== 'tiktok.com') return null;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeInstagram(value: unknown, task: TregSearchTask, fetchedAt: string): TregResearchCandidate | null {
  const post = object(value);
  if (!post || post.isAd === true) return null;
  const url = validSocialUrl(post.url, 'Instagram');
  const caption = string(post.caption)?.slice(0, 450);
  const author = string(post.username)?.replace(/^@/, '').slice(0, 60) ?? null;
  if (!url || !caption) return null;
  return {
    source: 'treg', platform: 'Instagram', category: 'social', topic: 'social',
    title: author ? `@${author} · Instagram` : 'Instagram post',
    summary: caption, url, publishedAt: postDate(post.createdUtc), fetchedAt,
    author, query: task.term, destinationSlug: task.destinationSlug,
  };
}

function normalizeTikTok(value: unknown, task: TregSearchTask, fetchedAt: string): TregResearchCandidate | null {
  const video = object(value);
  if (!video) return null;
  const author = string(video.author)?.replace(/^@/, '').slice(0, 60) ?? null;
  const id = string(video.id);
  const caption = string(video.caption)?.slice(0, 450);
  if (!author || !/^[A-Za-z0-9._]{2,30}$/.test(author) || !id || !/^\d{12,25}$/.test(id) || !caption) return null;
  const url = validSocialUrl(`https://www.tiktok.com/@${author}/video/${id}`, 'TikTok');
  if (!url) return null;
  return {
    source: 'treg', platform: 'TikTok', category: 'social', topic: 'social',
    title: `@${author} · TikTok`, summary: caption, url,
    publishedAt: postDate(video.createdUtc), fetchedAt, author, query: task.term,
    destinationSlug: task.destinationSlug,
  };
}

function taskDetails(task: TregSearchTask) {
  if (task.kind === 'instagram_hashtag') {
    const hashtag = task.term.replace(/^#/, '');
    if (!/^[A-Za-z0-9_]{3,40}$/.test(hashtag)) throw new Error('Invalid Instagram hashtag');
    return { endpoint: 'anyapi.instagram.hashtag_recent_posts', body: { hashtag }, listKey: 'posts' as const };
  }
  const term = task.term.trim();
  if (term.length < 3 || term.length > 80 || /[\r\n<>]/.test(term)) throw new Error('Invalid TikTok search term');
  return { endpoint: 'anyapi.tiktok.search.videos', body: { query: term, datePosted: 7, sortBy: 2 }, listKey: 'videos' as const };
}

/** Pinned catalog endpoints keep a stable provider shape and known price ceiling. */
export async function collectTregResearch(
  tasks: TregSearchTask[],
  options: {
    token?: string; fetchImpl?: typeof fetch; runId: string; now?: Date;
    onReceipt?: (receipt: TregCallReceipt) => void;
  } = { runId: '' },
): Promise<{ candidates: TregResearchCandidate[]; receipts: TregCallReceipt[] }> {
  const token = options.token ?? process.env.TREG_TOKEN;
  if (!token) throw new Error('Treg is not configured');
  if (tasks.length > 2 || !options.runId || options.runId.length > 100) throw new Error('Treg batch exceeds limit');
  const fetchImpl = options.fetchImpl ?? fetch;
  const candidates: TregResearchCandidate[] = [];
  const receipts: TregCallReceipt[] = [];
  for (const task of tasks) {
    const { endpoint, body, listKey } = taskDetails(task);
    const key = createHash('sha256').update(`${options.runId}|${endpoint}|${JSON.stringify(body)}`).digest('hex');
    const call = await tregCall({
      endpoint, method: 'POST', body, maxCostUsd: 0.01, maxAgeSeconds: 3600, idempotencyKey: key,
      token, fetchImpl, now: options.now, onReceipt: (receipt) => { receipts.push(receipt); options.onReceipt?.(receipt); },
    });
    if (!call.ok) throw new Error(`Treg request failed with status ${call.status}`);
    const root = object(call.json);
    const output = object(root?.output);
    const data = object(output?.data);
    const rows = data?.[listKey];
    if (!Array.isArray(rows)) throw new Error('Treg response is missing the expected social list');
    const { fetchedAt } = call;
    for (const row of rows.slice(0, 10)) {
      const normalized = task.kind === 'instagram_hashtag'
        ? normalizeInstagram(row, task, fetchedAt)
        : normalizeTikTok(row, task, fetchedAt);
      if (normalized) candidates.push(normalized);
    }
  }
  return { candidates, receipts };
}
