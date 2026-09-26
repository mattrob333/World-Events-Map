import { describe, expect, it } from 'vitest';
import { buildSearchCatalog, searchCatalog } from '../catalog';

describe('unified search catalog', () => {
  it('returns destinations and events for Aspen, and keeps shelved features out', () => {
    const hits = searchCatalog('aspen');
    const groups = new Set(hits.map((hit) => hit.group));
    expect(groups.has('destinations')).toBe(true);
    expect(groups.has('events')).toBe(true);
    // Access, sample circle rooms and example portraits are shelved (North Star spec) unless flagged on.
    expect(groups.has('access')).toBe(false);
    expect(groups.has('circles')).toBe(false);
    expect(buildSearchCatalog().some((hit) => hit.group === 'people')).toBe(false);
    expect(hits.some((hit) => hit.href.includes('/destinations/aspen'))).toBe(true);
  });

  it('includes Now and You as first-class page hits', () => {
    expect(searchCatalog('now').some((hit) => hit.href === '/now' && hit.title === 'Now')).toBe(true);
    expect(searchCatalog('family').some((hit) => hit.href === '/vibe')).toBe(true);
  });

  it('never labels editorial fixtures as saved (UFR-A08)', () => {
    expect(buildSearchCatalog().some((hit) => hit.group === 'saved')).toBe(false);
  });

  it('never calls curated status "live" (UFR-A08/C12)', () => {
    expect(buildSearchCatalog('2026-09-23').some((hit) => /\blive\b/i.test(hit.subtitle))).toBe(false);
  });

  it('routes editorial ideas through destination slugs', () => {
    const catalog = buildSearchCatalog();
    const saved = catalog.filter((hit) => hit.group === 'editorial' && hit.href.startsWith('/destinations/'));
    expect(saved.length).toBeGreaterThan(0);
    expect(saved.every((hit) => /^\/destinations\/[a-z0-9-]+$/.test(hit.href))).toBe(true);
  });
});
