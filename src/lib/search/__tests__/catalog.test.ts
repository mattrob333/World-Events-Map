import { describe, expect, it } from 'vitest';
import { buildSearchCatalog, searchCatalog } from '../catalog';

describe('unified search catalog', () => {
  it('returns destination, people, access and circle groups for Aspen', () => {
    const hits = searchCatalog('aspen');
    const groups = new Set(hits.map((hit) => hit.group));
    expect(groups.has('destinations')).toBe(true);
    expect(groups.has('events')).toBe(true);
    expect(groups.has('access')).toBe(true);
    expect(hits.some((hit) => hit.href.includes('/destinations/aspen'))).toBe(true);
  });

  it('labels people hits as editorial portraits', () => {
    const hits = searchCatalog('mara');
    expect(hits.some((hit) => hit.subtitle.includes('editorial'))).toBe(true);
  });

  it('includes NOW as a first-class page hit', () => {
    const hits = searchCatalog('now');
    expect(hits.some((hit) => hit.href === '/now' && hit.title === 'NOW')).toBe(true);
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
