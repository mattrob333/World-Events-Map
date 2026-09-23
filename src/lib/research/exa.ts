import 'server-only';

/** Search topics are fixed by the scheduled caller, never by a public request. */
export type ExaResearchTopic = 'festivals' | 'social-hype' | 'deals' | 'empty-legs';

export interface ExaResearchQuery {
  topic: ExaResearchTopic;
  query: string;
  destinationSlug?: string | null;
}

export interface ExaResearchCandidate {
  source: 'exa';
  title: string;
  canonicalUrl: string;
  summary: string | null;
  highlight: string | null;
  publishedAt: string | null;
  imageUrl: string | null;
  topic: ExaResearchTopic;
  query: string;
  fetchedAt: string;
  destinationSlug?: string | null;
}

export interface ExaResearchOptions {
  queries: readonly ExaResearchQuery[];
  /** ISO 8601 timestamp supplied by the scheduler for Exa's publication filter. */
  startPublishedDate: string;
  maxResultsPerQuery?: number;
  timeoutMs?: number;
}

export interface ExaResearchDependencies {
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

type UnknownRecord = Record<string, unknown>;

const SEARCH_URL = 'https://api.exa.ai/search';
const TOPICS: readonly ExaResearchTopic[] = ['festivals', 'social-hype', 'deals', 'empty-legs'];
const MAX_RESULTS_PER_QUERY = 10;
const MAX_TIMEOUT_MS = 12_000;

class ExaRequestError extends Error {}

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function httpsUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048 || /\p{Cc}/u.test(value)) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function isoTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.exec(value);
  if (!match) return null;
  const [year, month, day] = match.slice(1, 4).map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
  if (calendarDate !== `${match[1]}-${match[2]}-${match[3]}`) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function validatePlan(options: ExaResearchOptions): {
  queries: ExaResearchQuery[];
  startPublishedDate: string;
  maxResultsPerQuery: number;
  timeoutMs: number;
} {
  if (!Array.isArray(options.queries) || options.queries.length < 1 || options.queries.length > TOPICS.length) {
    throw new Error('Exa research requires one to four fixed-topic queries.');
  }
  const seen = new Set<ExaResearchTopic>();
  const queries = options.queries.map((item) => {
    if (!item || !TOPICS.includes(item.topic) || seen.has(item.topic)) {
      throw new Error('Exa research requires distinct, supported topics.');
    }
    seen.add(item.topic);
    const query = cleanText(item.query, 321);
    if (!query || query.length > 320) throw new Error('Exa research query is invalid.');
    if (item.destinationSlug !== undefined && item.destinationSlug !== null &&
        (typeof item.destinationSlug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.destinationSlug) || item.destinationSlug.length > 120)) {
      throw new Error('Exa research destination slug is invalid.');
    }
    return {
      topic: item.topic,
      query,
      ...(item.destinationSlug !== undefined ? { destinationSlug: item.destinationSlug } : {}),
    };
  });
  const startPublishedDate = isoTimestamp(options.startPublishedDate);
  if (!startPublishedDate) throw new Error('Exa research requires an ISO publication cutoff.');
  const maxResultsPerQuery = options.maxResultsPerQuery ?? 5;
  if (!Number.isInteger(maxResultsPerQuery) || maxResultsPerQuery < 1 || maxResultsPerQuery > MAX_RESULTS_PER_QUERY) {
    throw new Error('Exa research result limit is invalid.');
  }
  const timeoutMs = options.timeoutMs ?? 8_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_TIMEOUT_MS) {
    throw new Error('Exa research timeout is invalid.');
  }
  return { queries, startPublishedDate, maxResultsPerQuery, timeoutMs };
}

async function search(
  fetchImpl: typeof fetch,
  apiKey: string,
  query: string,
  startPublishedDate: string,
  maxResultsPerQuery: number,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ExaRequestError('Exa search timed out.'));
    }, timeoutMs);
  });

  try {
    const response = await Promise.race([
      fetchImpl(SEARCH_URL, {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          type: 'auto',
          numResults: maxResultsPerQuery,
          startPublishedDate,
          moderation: true,
          contents: { text: false, highlights: { maxCharacters: 500 }, summary: true },
        }),
        cache: 'no-store',
        signal: controller.signal,
      }),
      timeout,
    ]);
    if (!response.ok) {
      const status = Number.isInteger(response.status) ? response.status : 'unknown';
      throw new ExaRequestError(`Exa search failed (HTTP ${status}).`);
    }
    return await Promise.race([response.json() as Promise<unknown>, timeout]);
  } catch (error) {
    if (error instanceof ExaRequestError) throw error;
    throw new ExaRequestError('Exa search request failed.');
  } finally {
    clearTimeout(timer);
  }
}

function normalizeResult(
  value: unknown,
  plan: ExaResearchQuery,
  fetchedAt: string,
): ExaResearchCandidate | null {
  const result = record(value);
  if (!result) return null;
  const title = cleanText(result.title, 240);
  const canonicalUrl = httpsUrl(result.url);
  if (!title || !canonicalUrl) return null;
  const highlight = Array.isArray(result.highlights)
    ? result.highlights.map((item) => cleanText(item, 800)).find((item) => item !== null) ?? null
    : null;
  return {
    source: 'exa',
    title,
    canonicalUrl,
    summary: cleanText(result.summary, 1200),
    highlight,
    publishedAt: isoTimestamp(result.publishedDate),
    imageUrl: httpsUrl(result.image),
    topic: plan.topic,
    query: plan.query,
    fetchedAt,
    ...(plan.destinationSlug !== undefined ? { destinationSlug: plan.destinationSlug } : {}),
  };
}

/** Collects bounded source candidates; it does not verify claims, inventory, or prices. */
export async function collectExaResearch(
  options: ExaResearchOptions,
  dependencies: ExaResearchDependencies = {},
): Promise<ExaResearchCandidate[]> {
  const { queries, startPublishedDate, maxResultsPerQuery, timeoutMs } = validatePlan(options);
  const apiKey = process.env.EXA_API_KEY?.trim();
  if (!apiKey) throw new Error('Exa is not configured.');
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const now = dependencies.now ?? (() => new Date());
  const candidates: ExaResearchCandidate[] = [];
  const seenUrls = new Set<string>();

  // Queries within one call run sequentially and preserve plan order; the
  // sweep bounds concurrency by issuing a fixed number of calls.
  for (const plan of queries) {
    const payload = record(await search(fetchImpl, apiKey, plan.query, startPublishedDate, maxResultsPerQuery, timeoutMs));
    if (!payload || !Array.isArray(payload.results)) {
      throw new Error('Exa search returned an invalid response.');
    }
    const fetchedAt = now().toISOString();
    for (const row of payload.results.slice(0, maxResultsPerQuery)) {
      const candidate = normalizeResult(row, plan, fetchedAt);
      if (!candidate || seenUrls.has(candidate.canonicalUrl)) continue;
      seenUrls.add(candidate.canonicalUrl);
      candidates.push(candidate);
    }
  }
  return candidates;
}
