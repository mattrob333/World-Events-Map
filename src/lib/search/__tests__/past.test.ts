import { afterEach, describe, expect, it, vi } from 'vitest';
import { EVENTS } from '@/lib/data/events';
import { buildSearchCatalog } from '../catalog';

afterEach(() => vi.useRealTimers());

describe('search and ended events', () => {
  it('leaves out events that have ended, keeps the ones still to come', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));
    const ids = new Set(buildSearchCatalog().filter((hit) => hit.group === 'events').map((hit) => hit.id));
    const ended = EVENTS.filter((event) => event.end < '2026-10-03');
    const coming = EVENTS.filter((event) => event.end >= '2026-10-03');
    expect(ended.length).toBeGreaterThan(0);
    expect(ended.some((event) => ids.has(`event-${event.id}`))).toBe(false);
    expect(coming.every((event) => ids.has(`event-${event.id}`))).toBe(true);
  });
});
