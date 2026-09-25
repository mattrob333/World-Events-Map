import { describe, expect, it } from 'vitest';
import { plainText, safeHref, safeResearch } from './clientSafety';

const ok = <T,>(items: T[]) => ({ status: 'ok' as const, source: 'Google Maps' as const, fetchedAt: '2026-09-25T00:00:00Z', items });

describe('client research safety', () => {
  it('keeps only https provider links', () => {
    expect(safeHref('https://www.yelp.com/biz/x', ['yelp.com'])).toBe('https://www.yelp.com/biz/x');
    expect(safeHref('data:text/html,<script>alert(1)</script>', ['yelp.com'])).toBeUndefined();
    expect(safeHref('javascript:alert(1)')).toBeUndefined();
    expect(safeHref('https://evil.example/phish', ['yelp.com'])).toBeUndefined();
    expect(safeHref('https://yelp.com.evil.example/', ['yelp.com'])).toBeUndefined();
  });

  it('strips direction and invisible characters from names', () => {
    expect(plainText('‮evil Café​')).toBe('evil Café');
  });

  it('drops unsafe listings from a cached or tampered payload', () => {
    const spot = (id: string, url: string) => ({ id, name: `‮${id}`, source: 'Yelp' as const, url });
    const research = { place: 'Lisbon', generatedAt: '', configured: true, spentUsd: 0, capUsd: 0,
      topSpots: ok([spot('a', 'https://www.google.com/maps/search/?api=1&query=a'), spot('b', 'data:text/html,x')]),
      food: ok([spot('c', 'https://evil.example/')]), nightlife: ok([]), hiddenGems: ok([]), tripadvisor: ok([]), yelp: ok([]),
      instagram: ok([]), tiktok: ok([]), events: ok([{ id: 'e', title: 'Show', url: 'javascript:alert(1)', when: 'Fri' }]) };
    const clean = safeResearch(research as never) as typeof research;
    expect(clean.topSpots.items.map((item) => item.id)).toEqual(['a']);
    expect(clean.topSpots.items[0]!.name).toBe('a');
    expect(clean.food.items).toEqual([]);
    expect(clean.events.items).toEqual([]);
  });
});
