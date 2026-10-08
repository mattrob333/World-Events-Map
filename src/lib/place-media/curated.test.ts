import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EVENTS } from '@/lib/data/events';
import { orderShortlistEvents, selectSeasonalEvents, type TripInterest, type TripSeason } from '@/lib/discovery/seasonal';
import { curatedPhotoEntries, curatedPhotoForEvent, festivalPhotoEntries, photoArchiveLabel } from './curated';
import { photoImageProps } from './sources';

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
    // Hashes every photo file: quick alone, slow when the runner's disk is busy.
  }, 30_000);

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

  it('links every festival photo as a reviewed, credited Commons thumbnail', () => {
    const local = new Set(curatedPhotoEntries().map(([, photo]) => photo.sourceUrl));
    const sources = new Set<string>();
    const entries = festivalPhotoEntries();
    expect(entries.length).toBeGreaterThan(100);
    for (const [eventId, photo] of entries) {
      const event = EVENTS.find((candidate) => candidate.id === eventId);
      expect(event?.tags, eventId).toContain('electronic');
      // A stored local photo wins; a festival entry never shadows one.
      expect(curatedPhotoForEvent(eventId)).toBe(photo);
      expect(photo.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(local.has(photo.sourceUrl) || sources.has(photo.sourceUrl), eventId).toBe(false);
      sources.add(photo.sourceUrl);
      // Ported and 2.5 Creative Commons licences are free licences too.
      expect(photo.license, eventId).toMatch(/^(CC BY(?:-SA)? [1-4]\.[05](?: [A-Z]{2})?|CC0(?: 1\.0)?|Public domain)$/);
      expect(photo.credit.length, eventId).toBeGreaterThan(2);
      expect(photo.credit, eventId).not.toMatch(/unknown|[<>]/i);
      expect(['event', 'place']).toContain(photo.subject);
      expect(photoArchiveLabel(photo)).not.toMatch(/undefined|NaN/);
      // Only standard thumbnail widths: never the rate-limited original.
      const thumb = photo.imageUrl.match(/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/[0-9a-f]\/[0-9a-f]{2}\/[^/]+\/(\d+)px-[^/]+$/);
      expect(thumb, eventId).not.toBeNull();
      expect([960, 1280]).toContain(Number(thumb![1]));
      expect(photo.width).toBe(Number(thumb![1]));
      const props = photoImageProps(photo, 'card');
      expect(props.srcSet, eventId).toMatch(/330px-.* 330w/);
    }
  });
});
