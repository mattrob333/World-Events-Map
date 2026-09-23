import { describe, expect, it } from 'vitest';
import { EVENTS } from '@/lib/data/events';
import { buildDestinationPulses, getDestinationBySlug, slugifyPlace } from '../fromEvents';

describe('destination pulse', () => {
  it('slugifies place names without diacritics', () => {
    expect(slugifyPlace('São Paulo')).toBe('sao-paulo');
    expect(slugifyPlace('St. Moritz')).toBe('st-moritz');
    expect(slugifyPlace('Aspen')).toBe('aspen');
  });

  it('builds Aspen from curated ski calendar with honest provenance', () => {
    const pulses = buildDestinationPulses(EVENTS, '2026-09-19');
    const aspen = pulses.find((pulse) => pulse.name === 'Aspen');
    expect(aspen).toBeTruthy();
    expect(aspen!.slug).toBe('aspen');
    expect(aspen!.eventIds.length).toBeGreaterThan(0);
    expect(aspen!.whyNow.length).toBeGreaterThan(20);
    expect(aspen!.signals.booking?.note).toMatch(/not live inventory/i);
    expect(aspen!.signals.social?.note).toMatch(/not a live count/i);
    expect(aspen!.archetypes).toContain('ski');
    expect(['heating_up', 'seasonal', 'steady', 'live', 'cooling']).toContain(aspen!.status);
  });

  it('shows seasonal context as words, not a score that reads like snow (UFR-B06)', () => {
    const aspen = getDestinationBySlug(EVENTS, 'aspen', '2026-12-24');
    expect(aspen?.signals.weather?.displayValue).toBe('In season now');
    const offSeason = getDestinationBySlug(EVENTS, 'aspen', '2026-06-01');
    expect(offSeason?.signals.weather?.displayValue).toMatch(/Season/);
  });

  it('looks up a destination by slug', () => {
    const aspen = getDestinationBySlug(EVENTS, 'aspen', '2026-12-24');
    expect(aspen?.name).toBe('Aspen');
    expect(aspen?.status).toBe('live');
  });

  it('does not invent member or venue-live signals', () => {
    const pulses = buildDestinationPulses(EVENTS, '2026-09-19');
    for (const pulse of pulses) {
      expect(pulse.signals.members).toBeUndefined();
      expect(pulse.signals.venues).toBeUndefined();
      expect(pulse.whyNow.toLowerCase()).not.toMatch(/is live attendance/);
      expect(pulse.whyNow.toLowerCase()).not.toContain('live crowd');
    }
  });

  it('keeps destination slugs unique', () => {
    const pulses = buildDestinationPulses(EVENTS, '2026-09-19');
    const slugs = pulses.map((pulse) => pulse.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
