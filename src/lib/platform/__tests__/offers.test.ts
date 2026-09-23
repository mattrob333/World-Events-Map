import { describe, expect, it } from 'vitest';
import { validateOffer } from '../types';
const offer = {
  title: 'Terrace suite released',
  description: 'Three nights, breakfast included. Dates on request.',
  destination: 'Monaco',
  price_label: '€1,200 per night',
  expires_at: '2099-01-01T12:00:00Z',
};
describe('provider offer validation', () => {
  it('accepts an actionable offer with future expiry', () =>
    expect(validateOffer(offer)).toBeNull());
  it.each(['', 'not-a-date', '2001-01-01T12:00:00Z'])(
    'rejects invalid or expired availability %s',
    (expires_at) =>
      expect(validateOffer({ ...offer, expires_at })).toMatch(/future/),
  );
  it('rejects whitespace masquerading as a destination', () =>
    expect(validateOffer({ ...offer, destination: '  ' })).toMatch(
      /destination/,
    ));
  it('requires useful inclusions and terms', () =>
    expect(validateOffer({ ...offer, description: 'Buy now' })).toMatch(
      /inclusions/,
    ));
  it('bounds public headline and price copy', () => {
    expect(validateOffer({ ...offer, title: 'a'.repeat(141) })).toMatch(
      /title/,
    );
    expect(validateOffer({ ...offer, price_label: 'a'.repeat(101) })).toMatch(
      /price/,
    );
  });
  it.each(['Confirmed €45,000 — book now', 'Guaranteed berth'])(
    'rejects booking or confirmation language %s (UFR-E06)',
    (title) => expect(validateOffer({ ...offer, title })).toMatch(/inquiries/),
  );
  it('still accepts an ordinary indicative price', () =>
    expect(validateOffer({ ...offer, price_label: 'From €1,200 per night' })).toBeNull());
});
