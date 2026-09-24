import { describe, expect, it } from 'vitest';
import { HERO_POOL, heroRun, markSeen } from './pool';

const photo = (id: string, city: string) => ({ id, city, scene: '', region: '', title: '', credit: '', license: '', licenseUrl: '', sourceUrl: '' });
const list = [photo('a', 'Rio'), photo('b', 'Rio'), photo('c', 'Tokyo'), photo('d', 'Munich')];
const fixed = () => 0.5;

describe('hero pool', () => {
  it('ships 20 to 50 credited, labelled photos with unique ids', () => {
    expect(HERO_POOL.length).toBeGreaterThanOrEqual(20);
    expect(HERO_POOL.length).toBeLessThanOrEqual(50);
    expect(new Set(HERO_POOL.map((p) => p.id)).size).toBe(HERO_POOL.length);
    for (const p of HERO_POOL) {
      expect(p.city && p.region && p.credit && p.license).toBeTruthy();
      expect(p.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
      expect(p.license).toMatch(/^(CC BY|CC0|Public domain)/i);
      expect(p.id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('shows unseen photos first, then the least recently seen', () => {
    const run = heroRun(['c', 'a'], 4, fixed, list);
    expect(run.slice(0, 2).map((p) => p.id).sort()).toEqual(['b', 'd']);
    expect(run.slice(2).map((p) => p.id)).toEqual(['c', 'a']);
  });

  it('never repeats a city back to back when it can avoid it', () => {
    const run = heroRun([], 4, fixed, list);
    for (let i = 1; i < run.length; i++) expect(run[i].city).not.toBe(run[i - 1].city);
  });

  it('keeps the seen list bounded and most recent last', () => {
    expect(markSeen(['a', 'b', 'c'], ['a'], 3)).toEqual(['b', 'c', 'a']);
    expect(markSeen(['a', 'b', 'c'], ['d'], 3)).toEqual(['b', 'c', 'd']);
  });
});
