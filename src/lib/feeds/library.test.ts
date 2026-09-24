import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { librarySources, normalizeSource } from './library';

describe('source library', () => {
  it('loads every verified source with safe URLs and known tiers', () => {
    const sources = librarySources();
    expect(sources.length).toBeGreaterThanOrEqual(700);
    expect(new Set(sources.map((source) => source.feedUrl)).size).toBe(sources.length);
    expect(sources.every((source) => /^https?:\/\//.test(source.feedUrl) && ['A', 'B', 'C'].includes(source.tier))).toBe(true);
    expect(sources.filter((source) => source.signalOnly).length).toBeGreaterThan(0);
    expect(sources.filter((source) => !source.signalOnly && source.tripTypes.includes('ski')).length).toBeGreaterThanOrEqual(5);
  });

  it('falls back sensibly for first-generation entries and rejects bad ones', () => {
    expect(normalizeSource({ name: 'Old', feed_url: 'https://old.example/feed', beats: ['hot', 'hacks'], region: 'global' })).toMatchObject({ tier: 'C', tripTypes: ['city', 'points', 'deals'], regions: ['global'], signalOnly: false, needsFilter: false });
    expect(normalizeSource({ name: 'X', feed_url: 'javascript:alert(1)' })).toBeNull();
  });
});
