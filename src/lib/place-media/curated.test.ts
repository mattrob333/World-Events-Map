import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EVENTS } from '@/lib/data/events';
import { orderShortlistEvents, selectSeasonalEvents, type TripInterest, type TripSeason } from '@/lib/discovery/seasonal';
import { curatedPhotoEntries, curatedPhotoForEvent, photoArchiveLabel } from './curated';

describe('reviewed editorial imagery', () => {
  it('has distinct real files and licensed sources for every reviewed scene', () => {
    const hashes = new Set<string>();
    const sources = new Set<string>();
    for (const [eventId, photo] of curatedPhotoEntries()) {
      expect(EVENTS.some((event) => event.id === eventId)).toBe(true);
      expect(photo.imageUrl).toBe(`/editorial/${eventId}.jpg`);
      expect(photo.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(sources.has(photo.sourceUrl), eventId).toBe(false);
      sources.add(photo.sourceUrl);
      expect(photo.license).toMatch(/^(CC BY(?:-SA)? [1-4]\.0|CC0(?: 1\.0)?|Public domain)$/);
      expect(photo.credit.length).toBeGreaterThan(2);
      expect(photoArchiveLabel(photo)).not.toMatch(/undefined|NaN/);
      const bytes = readFileSync(join(process.cwd(), 'public', photo.imageUrl));
      expect(bytes.subarray(0, 2).toString('hex')).toBe('ffd8');
      const hash = createHash('sha256').update(bytes).digest('hex');
      expect(hashes.has(hash), eventId).toBe(false);
      hashes.add(hash);
    }
  });

  it.each([
    ['winter', 'ski'],
    ['spring', 'adventure'],
    ['summer', 'coast'],
    ['fall', 'culture'],
  ] as Array<[TripSeason, TripInterest]>)('gives the %s %s lead shortlist its own photos', (season, interest) => {
    const ranked = orderShortlistEvents(selectSeasonalEvents(EVENTS, '2026-09-23', season, interest), interest);
    const photographed = ranked.filter((event) => curatedPhotoForEvent(event.id));
    const lead = (photographed.length >= 4 ? photographed : ranked).slice(0, 6);
    expect(lead.length).toBeGreaterThanOrEqual(4);
    const images = lead.map((event) => curatedPhotoForEvent(event.id)?.imageUrl);
    expect(images, lead.map((event) => event.id).join(', ')).not.toContain(undefined);
    expect(new Set(images).size).toBe(images.length);
  });
});
