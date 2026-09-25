import { describe, expect, it } from 'vitest';
import { isShowable, latestStories } from './latestStories';
import type { Mention } from './match';

const NOW = new Date('2026-09-25T12:00:00Z');
const m = (title: string, source: string, tier: Mention['tier'] = 'A', publishedAt = '2026-09-24T10:00:00Z', url = `https://example.com/${encodeURIComponent(title)}`): Mention => ({ title, url, source, tier, publishedAt });
const place = (key: string, name: string, photo = true) => [key, { key, name, country: 'X', photo: photo ? { imageUrl: `/editorial/${key}.jpg`, credit: 'c' } : null, href: `/destinations/${key}` }] as const;

describe('home live strip', () => {
  it('drops service notices, gear reviews and foreign-language headlines', () => {
    expect(isShowable('Shangri-La Group announces Songtei Kyoto')).toBe(true);
    expect(isShowable('Info Metro RER trains, fermetures, travaux et manifestations à Paris')).toBe(false);
    expect(isShowable('Rover Pro Cabin Suitcase Vs Eume Overnighter')).toBe(false);
    expect(isShowable('Vol Paris-Tahiti : quelle compagnie choisir pour votre budget ?')).toBe(false);
  });

  it('keeps one story per source and per place, fresh and tiered, newest first', () => {
    const byPlace = new Map<string, Mention[]>([
      ['paris', [m('A new gallery opens in the Marais district', 'AD', 'A', '2026-09-24T09:00:00Z'), m('Another Paris gallery story here', 'AD', 'A', '2026-09-24T11:00:00Z')]],
      ['kyoto', [m('Shangri-La Group announces Songtei Kyoto', 'Hotel Designs', 'B', '2026-09-23T11:00:00Z'), m('Old news from Kyoto temple week', 'Old', 'A', '2026-09-10T00:00:00Z')]],
      ['lima', [m('Lima street food week opens next month', 'Tiny Blog', 'C')]],
    ]);
    const stories = latestStories(byPlace, new Map([place('paris', 'Paris'), place('kyoto', 'Kyoto'), place('lima', 'Lima')]), NOW);
    expect(stories.map((story) => story.place.name)).toEqual(['Paris', 'Kyoto']);
    expect(stories[0]!.source).toBe('AD');
    expect(stories[0]!.photo?.imageUrl).toBe('/editorial/paris.jpg');
  });
});
