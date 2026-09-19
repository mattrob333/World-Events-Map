import { describe, expect, it } from 'vitest';
import { searchCatalog } from '../catalog';

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
});
