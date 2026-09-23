import { expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/data/durable', () => ({ signalDatabase: () => null }));

import { prepareResearchRows, selectResearchForScreening } from './pipeline';
import type { ExaResearchCandidate } from './exa';
import type { TregResearchCandidate } from './treg';

const candidate: ExaResearchCandidate = {
  source: 'exa', title: 'Aspen winter festival dates', canonicalUrl: 'https://example.com/aspen?utm_source=test',
  summary: 'AI summary about an Aspen program.', highlight: 'The Aspen winter festival has published its January program.', imageUrl: null,
  publishedAt: '2026-09-21T00:00:00Z', topic: 'festivals', query: 'Aspen winter festival',
  fetchedAt: '2026-09-22T00:00:00Z', destinationSlug: 'aspen',
};

it('persists publisher evidence without tracking URLs and never promotes inventory claims', () => {
  const id = prepareResearchRows([candidate], [], '2026-09-22T12:00:00Z')[0].id;
  const verdict = { candidateId: id, decision: 'publish' as const, score: 91, confidence: 0.9,
    dimensions: { relevance: 0.9, quality: 0.9, freshness: 0.85 }, reasonCodes: [] };
  const rows = prepareResearchRows([
    candidate,
    { ...candidate, topic: 'empty-legs' as const, canonicalUrl: 'https://example.com/flight' },
  ], [verdict, { ...verdict, candidateId: prepareResearchRows([{ ...candidate, topic: 'empty-legs', canonicalUrl: 'https://example.com/flight' }], [], '2026-09-22T12:00:00Z')[0].id }], '2026-09-22T12:00:00Z');
  expect(rows[0]).toMatchObject({ url: 'https://example.com/aspen', decision: 'publish', destination_slug: 'aspen', score: 91 });
  expect(rows[0].excerpt).toBe(candidate.highlight);
  expect(rows[1]).toMatchObject({ category: 'flight', decision: 'review' });
  expect(rows[1].reasons).toContain('inventory_requires_verification');
});

it('keeps generated-only Exa summaries in review and out of paid screening', () => {
  const withoutHighlight = { ...candidate, highlight: null };
  const id = prepareResearchRows([withoutHighlight], [], '2026-09-22T12:00:00Z')[0].id;
  const verdict = { candidateId: id, decision: 'publish' as const, score: 95, confidence: 0.95,
    dimensions: { relevance: 0.95, quality: 0.95, freshness: 0.95 }, reasonCodes: [] };
  const row = prepareResearchRows([withoutHighlight], [verdict], '2026-09-22T12:00:00Z')[0];
  expect(row.decision).toBe('review');
  expect(row.reasons).toContain('source_excerpt_unavailable');
  expect(selectResearchForScreening([withoutHighlight])).toEqual([]);
});

it('reserves Jev screening slots for both destinations and social posts', () => {
  const exa = Array.from({ length: 20 }, (_, index): ExaResearchCandidate => ({
    ...candidate,
    destinationSlug: index < 10 ? 'aspen' : 'munich',
    canonicalUrl: `https://example.com/article-${index}`,
  }));
  const social = Array.from({ length: 20 }, (_, index): TregResearchCandidate => ({
    source: 'treg', platform: 'Instagram', category: 'social', topic: 'social',
    title: 'Winter festival video', summary: 'Travelers at the ski festival',
    url: `https://www.instagram.com/p/post-${index}/`,
    author: 'traveler', query: '#aspen',
    publishedAt: candidate.publishedAt, fetchedAt: candidate.fetchedAt,
    destinationSlug: index < 10 ? 'aspen' : 'munich',
  }));
  const commercial = { ...candidate, topic: 'empty-legs' as const, canonicalUrl: 'https://example.com/flight' };
  const selected = selectResearchForScreening([...exa, commercial, ...social]);
  expect(selected).toHaveLength(12);
  expect(selected.filter((item) => item.source === 'exa')).toHaveLength(6);
  expect(selected.filter((item) => item.source === 'treg')).toHaveLength(6);
  expect(selected.filter((item) => item.destinationSlug === 'aspen')).toHaveLength(6);
  expect(selected.filter((item) => item.destinationSlug === 'munich')).toHaveLength(6);
  expect(selected).not.toContain(commercial);
});
