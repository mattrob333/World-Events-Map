import { expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/data/durable', () => ({ signalDatabase: () => null }));

import { readResearchFeed, researchItemForPublicFeed } from './feed';

const now = Date.parse('2026-09-22T18:00:00Z');
const fresh = {
  id: 'a', title: 'A festival worth considering', excerpt: 'Source summary',
  url: 'https://example.org/story', source: 'exa', platform: 'Example News',
  category: 'article', topic: 'festivals', destination_slug: 'monte-carlo',
  published_at: '2026-09-21T18:00:00Z', fetched_at: '2026-09-22T17:00:00Z', author: null,
};

it('shows sourced current stories and drops stale, unsafe, and unverified inventory', () => {
  expect(researchItemForPublicFeed(fresh, now)).toMatchObject({ title: fresh.title, destinationSlug: 'monte-carlo' });
  expect(researchItemForPublicFeed({ ...fresh, published_at: null }, now)).toBeNull();
  expect(researchItemForPublicFeed({ ...fresh, published_at: '2026-07-01T18:00:00Z' }, now)).toBeNull();
  expect(researchItemForPublicFeed({ ...fresh, url: 'javascript:alert(1)' }, now)).toBeNull();
  expect(researchItemForPublicFeed({ ...fresh, category: 'flight' }, now)).toBeNull();
  expect(researchItemForPublicFeed({ ...fresh, category: 'social', published_at: '2026-09-01T18:00:00Z' }, now)).toBeNull();
});

it('is explicitly unconfigured without durable storage', async () => {
  expect((await readResearchFeed()).status).toBe('unconfigured');
});
