import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { collectExaResearch, type ExaResearchOptions } from './exa';

const cutoff = '2026-09-01T00:00:00.000Z';
const fixedNow = () => new Date('2026-09-22T14:00:00.000Z');
const baseOptions: ExaResearchOptions = {
  queries: [{ topic: 'festivals', query: '  upcoming    travel festivals  ', destinationSlug: 'new-york' }],
  startPublishedDate: cutoff,
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('collectExaResearch', () => {
  it('uses bounded Exa requests and preserves source and caller metadata', async () => {
    vi.stubEnv('EXA_API_KEY', 'test-secret');
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        results: [
          {
            title: '  Festival   week ',
            url: 'https://EXAMPLE.com/festival#tickets',
            summary: '  A week   of events. ',
            highlights: [null, '  Opening night   details.  '],
            publishedDate: '2026-09-20T10:30:00+02:00',
            image: 'https://example.com/hero.jpg',
          },
          { title: 'Second', url: 'https://example.com/second' },
          { title: 'Excess', url: 'https://example.com/excess' },
        ],
      }))
      .mockResolvedValueOnce(jsonResponse({
        results: [
          { title: 'Duplicate', url: 'https://example.com/festival' },
          { title: 'Jet story', url: 'https://example.com/jet', publishedDate: null },
        ],
      }));

    const result = await collectExaResearch({
      ...baseOptions,
      queries: [
        ...baseOptions.queries,
        { topic: 'empty-legs', query: 'private aviation empty legs' },
      ],
      maxResultsPerQuery: 2,
    }, { fetchImpl, now: fixedNow });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.exa.ai/search');
    expect(init.method).toBe('POST');
    expect(init.cache).toBe('no-store');
    expect(init.headers).toMatchObject({ 'x-api-key': 'test-secret' });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(String(init.body))).toMatchObject({
      query: 'upcoming travel festivals',
      numResults: 2,
      startPublishedDate: cutoff,
      type: 'auto',
      moderation: true,
      contents: { highlights: { maxCharacters: 500 }, summary: true },
    });
    expect(result).toEqual([
      {
        source: 'exa',
        title: 'Festival week',
        canonicalUrl: 'https://example.com/festival',
        summary: 'A week of events.',
        highlight: 'Opening night details.',
        publishedAt: '2026-09-20T08:30:00.000Z',
        imageUrl: 'https://example.com/hero.jpg',
        topic: 'festivals',
        query: 'upcoming travel festivals',
        fetchedAt: '2026-09-22T14:00:00.000Z',
        destinationSlug: 'new-york',
      },
      {
        source: 'exa',
        title: 'Second',
        canonicalUrl: 'https://example.com/second',
        summary: null,
        highlight: null,
        publishedAt: null,
        imageUrl: null,
        topic: 'festivals',
        query: 'upcoming travel festivals',
        fetchedAt: '2026-09-22T14:00:00.000Z',
        destinationSlug: 'new-york',
      },
      {
        source: 'exa',
        title: 'Jet story',
        canonicalUrl: 'https://example.com/jet',
        summary: null,
        highlight: null,
        publishedAt: null,
        imageUrl: null,
        topic: 'empty-legs',
        query: 'private aviation empty legs',
        fetchedAt: '2026-09-22T14:00:00.000Z',
      },
    ]);
  });

  it('fails closed before network access when EXA_API_KEY is missing', async () => {
    vi.stubEnv('EXA_API_KEY', '   ');
    const fetchImpl = vi.fn();
    await expect(collectExaResearch(baseOptions, { fetchImpl })).rejects.toThrow('Exa is not configured.');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects unbounded or unsupported plans before network access', async () => {
    vi.stubEnv('EXA_API_KEY', 'test-secret');
    const fetchImpl = vi.fn();
    const invalidPlans: ExaResearchOptions[] = [
      { ...baseOptions, queries: [] },
      { ...baseOptions, queries: [...baseOptions.queries, ...baseOptions.queries] },
      { ...baseOptions, queries: [{ topic: 'anything' as 'festivals', query: 'query' }] },
      { ...baseOptions, queries: [{ topic: 'festivals', query: ' ' }] },
      { ...baseOptions, queries: [{ topic: 'festivals', query: 'x'.repeat(321) }] },
      { ...baseOptions, startPublishedDate: 'yesterday' },
      { ...baseOptions, maxResultsPerQuery: 11 },
      { ...baseOptions, timeoutMs: 12_001 },
      { ...baseOptions, queries: [{ topic: 'deals', query: 'hotel deals', destinationSlug: '../admin' }] },
    ];
    for (const plan of invalidPlans) {
      await expect(collectExaResearch(plan, { fetchImpl })).rejects.toThrow();
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('skips invalid rows and does not manufacture dates, image URLs, or prices', async () => {
    vi.stubEnv('EXA_API_KEY', 'test-secret');
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      results: [
        null,
        { title: 'No URL' },
        { title: 'Script URL', url: 'javascript:alert(1)' },
        { title: 'Insecure', url: 'http://example.com/deal' },
        { title: {}, url: 'https://example.com/no-title' },
        { title: 'Credentials', url: 'https://user:pass@example.com/private' },
        {
          title: '  Festival listing  ',
          url: 'https://example.com/event#details',
          summary: { arbitrary: 'object' },
          highlights: [42, ' Verified source passage '],
          publishedDate: '2026-02-30T10:00:00Z',
          image: 'data:image/svg+xml,unsafe',
          price: 42,
        },
      ],
    }));
    const result = await collectExaResearch({ ...baseOptions, maxResultsPerQuery: 10 }, { fetchImpl, now: fixedNow });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      canonicalUrl: 'https://example.com/event',
      summary: null,
      highlight: 'Verified source passage',
      publishedAt: null,
      imageUrl: null,
    });
    expect(result[0]).not.toHaveProperty('price');
  });

  it('does not expose response bodies or keys on provider errors', async () => {
    vi.stubEnv('EXA_API_KEY', 'very-secret');
    const fetchImpl = vi.fn().mockResolvedValue(new Response('very-secret in provider error', { status: 429 }));
    await expect(collectExaResearch(baseOptions, { fetchImpl })).rejects.toThrow('Exa search failed (HTTP 429).');
  });

  it('aborts a request that exceeds the configured timeout', async () => {
    vi.stubEnv('EXA_API_KEY', 'test-secret');
    let signal: AbortSignal | undefined;
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => {
      signal = init?.signal as AbortSignal;
      return new Promise<Response>(() => {});
    }) as typeof fetch;
    await expect(collectExaResearch({ ...baseOptions, timeoutMs: 10 }, { fetchImpl })).rejects.toThrow('Exa search timed out.');
    expect(signal?.aborted).toBe(true);
  });

  it('rejects malformed provider response shapes', async () => {
    vi.stubEnv('EXA_API_KEY', 'test-secret');
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ results: 'not an array' }));
    await expect(collectExaResearch(baseOptions, { fetchImpl })).rejects.toThrow('Exa search returned an invalid response.');
  });
});
