import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { evaluateResearchCandidates, type ResearchCandidate } from './jev';

const NOW = new Date('2026-09-22T12:00:00Z');

function candidate(overrides: Partial<ResearchCandidate> = {}): ResearchCandidate {
  return {
    id: 'venice-2027',
    title: 'Venice festival announces 2027 dates',
    url: 'https://example.org/venice-festival-dates',
    summary: 'The festival organizer announced September 2027 dates and named the Venice venue in a new public schedule.',
    publishedAt: '2026-09-21',
    source: 'Example News',
    topic: 'arts travel',
    fetchedAt: '2026-09-22T11:00:00Z',
    destinationSlug: null,
    ...overrides,
  };
}

function jevResponse(options: { relevance?: number; quality?: number; freshness?: number; confidence?: number } = {}): Response {
  const level = options.freshness ?? 3;
  const lower = Math.floor(level);
  const upper = Math.ceil(level);
  const probabilities = { '0': 0, '1': 0, '2': 0, '3': 0 };
  probabilities[String(lower) as keyof typeof probabilities] = upper - level || 1;
  if (upper !== lower) probabilities[String(upper) as keyof typeof probabilities] = level - lower;
  return new Response(JSON.stringify({
    model: 'jev-latest',
    answers: {
      travel_relevance: { type: 'noul', noul: options.relevance ?? 0.96 },
      original_evidence: { type: 'noul', noul: options.quality ?? 0.93 },
      material_freshness: {
        type: 'score',
        score: level,
        confidence: options.confidence ?? 0.95,
        legend: { '0': 'Evergreen', '1': 'Recap', '2': 'Development', '3': 'Announcement' },
        probabilities,
      },
    },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

describe('Jev editorial screening', () => {
  it('publishes only a fresh, topical result with strong separate judgments', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jevResponse());
    const [verdict] = await evaluateResearchCandidates([candidate()], { apiKey: 'secret', now: NOW, fetchImpl });

    expect(verdict).toMatchObject({
      candidateId: 'venice-2027',
      decision: 'publish',
      score: 96,
      confidence: 0.95,
      dimensions: { relevance: 0.96, quality: 0.93, freshness: 1 },
      reasonCodes: [],
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://api.typesafe.ai/v1/systemone');
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer secret' });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe('jev-latest');
    expect(Object.keys(body.questions)).toEqual(['travel_relevance', 'original_evidence', 'material_freshness']);
    expect(body.questions.travel_relevance.type).toBe('noul');
    expect(body.questions.original_evidence.type).toBe('noul');
    expect(body.questions.material_freshness.type).toBe('score');
    expect(body.questions.material_freshness.criteria).toHaveLength(4);
  });

  it('hard-filters unknown or stale publication dates, irrelevant content, and bad URLs before Jev', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const verdicts = await evaluateResearchCandidates([
      candidate({ id: 'unknown', publishedAt: null }),
      candidate({ id: 'stale', publishedAt: '2026-07-01' }),
      candidate({ id: 'irrelevant', title: 'Quarterly earnings announced', summary: 'A manufacturer reports results and updates its dividend.' }),
      candidate({ id: 'bad-url', url: 'javascript:alert(1)' }),
      candidate({ id: 'insecure-url', url: 'http://example.org/story' }),
      candidate({ id: 'invalid-date', publishedAt: '2026-02-30' }),
    ], { apiKey: 'secret', now: NOW, fetchImpl });

    expect(verdicts.map(({ decision, reasonCodes }) => [decision, reasonCodes[0]])).toEqual([
      ['review', 'unknown_published_at'],
      ['reject', 'stale_published_at'],
      ['reject', 'off_topic'],
      ['reject', 'invalid_url'],
      ['reject', 'invalid_url'],
      ['review', 'invalid_published_at'],
    ]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not publish a result for a destination merely because the retrieval query tagged it', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jevResponse());
    const verdicts = await evaluateResearchCandidates([
      candidate({
        id: 'vail-for-aspen', destinationSlug: 'aspen',
        title: 'Vail ski season opening announced',
        summary: 'The Vail resort confirmed winter lift and event dates for travelers.',
        topic: 'Aspen Colorado ski season',
        source: 'Aspen travel search result',
        url: 'https://example.org/aspen-search/vail-opening',
      }),
      candidate({
        id: 'region-for-city', destinationSlug: 'puerto-ayora',
        title: 'Galápagos islands travel festival announced',
        summary: 'The organizer announced new dates across the islands for visiting travelers.',
      }),
      candidate({ id: 'unsupported-city', destinationSlug: 'unlisted-city' }),
      candidate({ id: 'paris-texas', destinationSlug: 'paris', title: 'Paris, Texas travel festival announced' }),
    ], { apiKey: 'secret', now: NOW, fetchImpl });

    expect(verdicts.map((item) => [item.decision, item.reasonCodes])).toEqual([
      ['review', ['missing_destination_evidence']],
      ['review', ['missing_destination_evidence']],
      ['review', ['unknown_destination']],
      ['review', ['missing_destination_evidence']],
    ]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('requires place evidence in returned text and asks Jev about the actual destination', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => jevResponse());
    const verdicts = await evaluateResearchCandidates([
      candidate({
        id: 'monaco-venue', destinationSlug: 'monte-carlo',
        title: 'Monaco Yacht Show confirms new September visitor dates',
        summary: 'The Monaco organizer announced dates and a harbor venue for travelers.',
      }),
      candidate({
        id: 'puerto-ayora-venue', destinationSlug: 'puerto-ayora',
        title: 'Festival dates announced in Puerto Ayora',
        summary: 'The organizer named a Puerto Ayora venue in the new public schedule.',
      }),
      candidate({ id: 'aspen-venue', destinationSlug: 'aspen', title: 'Aspen ski season dates announced' }),
      candidate({ id: 'munich-venue', destinationSlug: 'munich', title: 'München festival dates announced' }),
      candidate({ id: 'paris-venue', destinationSlug: 'paris', title: 'Paris Fashion Week dates announced' }),
      candidate({ id: 'jaipur-venue', destinationSlug: 'jaipur', title: 'Jaipur Diwali festival dates announced' }),
    ], { apiKey: 'secret', now: NOW, fetchImpl });

    expect(verdicts.map((item) => item.decision)).toEqual(Array(6).fill('publish'));
    expect(fetchImpl).toHaveBeenCalledTimes(6);
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(body.state.destination).toBe('Monte Carlo, Monaco');
    expect(body.questions.travel_relevance.instructions).toContain('actual place');
    expect(body.questions.travel_relevance.instructions).toContain('Do not infer location from `topic`');
  });

  it('routes malformed or low-confidence model answers to review', async () => {
    const malformed = new Response(JSON.stringify({
      answers: {
        travel_relevance: { type: 'noul', noul: 0.9 },
        original_evidence: { type: 'noul', noul: 0.9 },
        material_freshness: { type: 'score', score: 3, confidence: 0.95, probabilities: { '3': 1 } },
      },
    }), { status: 200 });
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(malformed)
      .mockResolvedValueOnce(jevResponse({ confidence: 0.2 }));

    const [invalid, uncertain] = await evaluateResearchCandidates([
      candidate({ id: 'malformed' }),
      candidate({ id: 'uncertain' }),
    ], { apiKey: 'secret', now: NOW, fetchImpl });

    expect(invalid).toMatchObject({ decision: 'review', score: null, confidence: null, reasonCodes: ['provider_invalid_response'] });
    expect(uncertain).toMatchObject({ decision: 'review', confidence: 0.2, reasonCodes: ['low_model_confidence'] });
  });

  it('routes provider auth and network errors to review without exposing error details', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockRejectedValueOnce(new Error('Bearer secret should not appear in verdict'));
    const verdicts = await evaluateResearchCandidates([
      candidate({ id: 'auth' }),
      candidate({ id: 'network' }),
    ], { apiKey: 'secret', now: NOW, fetchImpl });

    expect(verdicts.map((item) => item.reasonCodes)).toEqual([['provider_auth_error'], ['provider_http_error']]);
    expect(JSON.stringify(verdicts)).not.toContain('secret');
    expect(verdicts.every((item) => item.decision === 'review')).toBe(true);
  });

  it('keeps price and inventory claims in review even with strong model scores', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jevResponse())
      .mockResolvedValueOnce(jevResponse({ relevance: 0.1, quality: 0.1, freshness: 0 }));
    const verdicts = await evaluateResearchCandidates([
      candidate({ title: 'Venice festival tickets on sale now', summary: 'The organizer announced September 2027 dates and tickets available today.' }),
      candidate({ id: 'empty-leg', title: 'Empty leg flight deal announced', summary: 'A charter operator advertises an empty leg flight deal today.' }),
    ], { apiKey: 'secret', now: NOW, fetchImpl });

    expect(verdicts[0]).toMatchObject({ decision: 'review', reasonCodes: ['commercial_claim'] });
    expect(verdicts[1]).toMatchObject({ decision: 'review' });
    expect(verdicts[1]?.reasonCodes).toContain('commercial_claim');
  });

  it('lets social travel topics reach Jev without relying on the topic label', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => jevResponse());
    const titles = [
      'Alpine skiing season dates announced',
      'Snowboarding competition schedule released',
      'Yacht regatta confirms harbor dates',
      'Sailing week adds a new venue',
      'Beach club reopening announced',
      'Nightlife district updates schedule',
    ];
    const verdicts = await evaluateResearchCandidates(
      titles.map((title, index) => candidate({
        id: `social-${index}`,
        title,
        summary: 'The organizer announced September 2027 dates and named a Venice venue in a new public schedule.',
        topic: 'uncategorized',
      })),
      { apiKey: 'secret', now: NOW, fetchImpl },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(titles.length);
    expect(verdicts.every((item) => item.decision === 'publish')).toBe(true);
  });

  it('caps paid calls per invocation and reviews overflow', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => jevResponse());
    const results = await evaluateResearchCandidates(
      Array.from({ length: 14 }, (_, index) => candidate({ id: `item-${index}` })),
      { apiKey: 'secret', now: NOW, fetchImpl },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(12);
    expect(results).toHaveLength(14);
    expect(results.slice(12).map((item) => item.reasonCodes)).toEqual([['batch_limit'], ['batch_limit']]);
  });

  it('supports a zero paid-call budget and handles malformed search results per candidate', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const verdicts = await evaluateResearchCandidates([
      candidate({ id: 'no-budget' }),
      candidate({ id: 'no-summary', summary: undefined as unknown as string }),
    ], { apiKey: 'secret', now: NOW, fetchImpl, maxCandidates: 0 });

    expect(verdicts.map((item) => item.reasonCodes)).toEqual([['batch_limit'], ['invalid_candidate']]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
