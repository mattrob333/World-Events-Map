import { expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { collectTregResearch } from './treg';

it('reads only dated, linked social posts from the pinned Treg endpoint', async () => {
  const createdUtc = Math.floor(Date.now() / 1000) - 3600;
  const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
    output: { data: { posts: [
      { caption: 'Festival in Monte Carlo tonight', url: 'https://www.instagram.com/p/abc123/?utm_source=x', username: 'traveler', createdUtc },
      { caption: 'Sponsored yacht trip', url: 'https://www.instagram.com/p/sponsor/', username: 'ad', createdUtc, isAd: true },
      { caption: 'Bad link', url: 'https://evil.test/p/abc/', username: 'scammer', createdUtc },
    ] } },
  }), { status: 200, headers: { 'x-treg-call-id': 'call_1', 'x-treg-cost-micro': '2400' } }));
  const result = await collectTregResearch(
    [{ kind: 'instagram_hashtag', term: 'monacoyachtshow', destinationSlug: 'monte-carlo' }],
    { token: 'test-token', fetchImpl: fetchImpl as typeof fetch, runId: '2026-09-22-am' },
  );
  expect(result.candidates).toHaveLength(1);
  expect(result.candidates[0]).toMatchObject({
    platform: 'Instagram', author: 'traveler', destinationSlug: 'monte-carlo',
    url: 'https://www.instagram.com/p/abc123/',
  });
  expect(result.receipts).toEqual([{ endpoint: 'anyapi.instagram.hashtag_recent_posts', callId: 'call_1', costMicro: 2400 }]);
  expect(fetchImpl).toHaveBeenCalledWith('https://treg.to/call/anyapi.instagram.hashtag_recent_posts', expect.objectContaining({
    headers: expect.objectContaining({ 'X-Treg-Route-Max-Cost': '0.01', 'Idempotency-Key': expect.any(String) }),
  }));
});

it('fails closed before any paid call when the token or batch bounds are absent', async () => {
  const fetchImpl = vi.fn();
  await expect(collectTregResearch([{ kind: 'instagram_hashtag', term: 'ski' }], {
    token: '', fetchImpl: fetchImpl as typeof fetch, runId: 'run',
  })).rejects.toThrow(/not configured/);
  await expect(collectTregResearch([
    { kind: 'instagram_hashtag', term: 'ski' },
    { kind: 'instagram_hashtag', term: 'snow' },
    { kind: 'instagram_hashtag', term: 'aspen' },
  ], { token: 'key', fetchImpl: fetchImpl as typeof fetch, runId: 'run' })).rejects.toThrow(/exceeds limit/);
  expect(fetchImpl).not.toHaveBeenCalled();
});

it('requires the documented response list instead of accepting an unknown provider shape', async () => {
  const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ output: { data: {} } }), { status: 200 }));
  await expect(collectTregResearch([{ kind: 'tiktok_search', term: 'aspen skiing' }], {
    token: 'key', fetchImpl: fetchImpl as typeof fetch, runId: 'run',
  })).rejects.toThrow(/missing the expected social list/);
});
