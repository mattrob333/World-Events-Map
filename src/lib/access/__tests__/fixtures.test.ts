import { describe, expect, it } from 'vitest';
import { AVAILABILITY_COPY, OPPORTUNITY_FIXTURES, SAMPLE_OFFER_NOTE, offerWindowLabel } from '..';

describe('ACCESS sample offers (red team UFR-C05, B07, E04, C08)', () => {
  it('marks every fixture as a sample', () => {
    expect(OPPORTUNITY_FIXTURES.every((offer) => offer.sample)).toBe(true);
  });

  it('never lets a sample claim a provider action', () => {
    for (const offer of OPPORTUNITY_FIXTURES) {
      expect(offer.availability).not.toBe('provider_updated');
      const rendered = [offer.body, offer.availabilityLabel, SAMPLE_OFFER_NOTE, AVAILABILITY_COPY[offer.availability]].join(' ');
      expect(rendered).not.toMatch(/confirmed by the provider|dope.travel will pass/i);
    }
  });

  it('gives every card a date window or says dates are on request', () => {
    for (const offer of OPPORTUNITY_FIXTURES) expect(offerWindowLabel(offer)).toMatch(/\S/);
    expect(offerWindowLabel({})).toBe('Dates on request');
  });
});
