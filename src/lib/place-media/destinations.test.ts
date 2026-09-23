import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { curatedPhotosForDestination } from './destinations';

describe('destination editorial scenes', () => {
  it('leads Aspen with its mountain-to-town panorama and keeps Lift 1A once', () => {
    const photos = curatedPhotosForDestination('aspen');
    expect(photos[0].imageUrl).toBe('/editorial/destination-aspen-hero.jpg');
    expect(photos.filter((photo) => photo.imageUrl === '/editorial/aspen-christmas-week.jpg')).toHaveLength(1);
  });

  it.each(['aspen', 'courchevel', 'gstaad', 'st-moritz', 'niseko', 'teton-village'])
    ('provides distinct local, credited scenes for %s', (slug) => {
      const photos = curatedPhotosForDestination(slug);
      expect(photos.length).toBeGreaterThanOrEqual(2);
      expect(new Set(photos.map((photo) => photo.sourceUrl)).size).toBe(photos.length);
      for (const photo of photos) {
        expect(photo.caption.length).toBeGreaterThan(10);
        expect(photo.credit.length).toBeGreaterThan(2);
        expect(photo.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
        expect(photo.license).toMatch(/^(CC BY(?:-SA)? [1-4]\.0|CC0|Public domain)$/);
        expect(photo.imageUrl).toMatch(/^\/editorial\/[a-z0-9-]+\.jpg$/);
        const bytes = readFileSync(join(process.cwd(), 'public', photo.imageUrl));
        expect(bytes.subarray(0, 2).toString('hex')).toBe('ffd8');
      }
    });

  it('returns an empty gallery for an unreviewed destination', () => {
    expect(curatedPhotosForDestination('unknown-place')).toEqual([]);
  });
});
