import { describe, expect, it } from 'vitest';
import { affiliateConfig, affiliateDisclosure, handoffNote, openTableSearch, takesTableSearch, withAffiliate } from './partners';

const none = affiliateConfig({});
const ids = affiliateConfig({
  NEXT_PUBLIC_BOOKING_AID: '1234567',
  NEXT_PUBLIC_OPENTABLE_REF: 'dope-ref',
  NEXT_PUBLIC_VRBO_AFFILIATE_QUERY: 'affcid=abc123&my_ad=AFF.US',
});

describe('booking partners', () => {
  it('builds a pre-filled OpenTable search', () => {
    const url = new URL(openTableSearch({ name: 'Cervejaria Ramiro', where: 'Lisbon', date: '2026-10-10', time: '20:00', covers: 2 }, none));
    expect(url.origin).toBe('https://www.opentable.com');
    expect(url.searchParams.get('term')).toBe('Cervejaria Ramiro Lisbon');
    expect(url.searchParams.get('covers')).toBe('2');
    expect(url.searchParams.get('dateTime')).toBe('2026-10-10T20:00');
    expect(url.searchParams.has('ref')).toBe(false);
  });

  it('keeps the city when a long name has to be trimmed', () => {
    const name = `${'Taberna do Chiado Petiscos e Vinho da Casa e Muito Amor '.repeat(4)}`.trim();
    const term = new URL(openTableSearch({ name, where: 'Lisbon', covers: 2 }, none)).searchParams.get('term')!;
    expect(term.length).toBeLessThanOrEqual(120);
    expect(term.endsWith(' Lisbon')).toBe(true);
    expect(term).not.toMatch(/ Amo Lisbon$/);
  });

  it('discloses commissions only when an affiliate ID is live', () => {
    expect(affiliateDisclosure(none)).toBeNull();
    expect(affiliateDisclosure(ids)).toMatch(/commission/);
  });

  it('skips bakeries, cafés and food halls', () => {
    expect(takesTableSearch({ name: 'Pastéis de Belém', category: 'Bakery' })).toBe(false);
    expect(takesTableSearch({ name: 'Time Out Market', category: 'Food hall' })).toBe(false);
    expect(takesTableSearch({ name: 'Cervejaria Ramiro', category: 'Seafood restaurant' })).toBe(true);
  });

  it('defaults dinner to 19:30 and clamps the party', () => {
    const url = new URL(openTableSearch({ name: 'X', date: '2026-10-10', covers: 99 }, none));
    expect(url.searchParams.get('dateTime')).toBe('2026-10-10T19:30');
    expect(url.searchParams.get('covers')).toBe('20');
  });

  it('adds affiliate tracking only on the partner’s own domain', () => {
    expect(new URL(withAffiliate('booking', 'https://www.booking.com/searchresults.html?ss=Lisbon', ids)).searchParams.get('aid')).toBe('1234567');
    expect(new URL(openTableSearch({ name: 'X', covers: 2 }, ids)).searchParams.get('ref')).toBe('dope-ref');
    const vrbo = new URL(withAffiliate('vrbo', 'https://www.vrbo.com/search?destination=Aspen', ids));
    expect(vrbo.searchParams.get('affcid')).toBe('abc123');
    expect(vrbo.searchParams.get('destination')).toBe('Aspen');
    expect(withAffiliate('booking', 'https://evil.example/booking.com', ids)).toBe('https://evil.example/booking.com');
    expect(withAffiliate('airbnb', 'https://www.airbnb.com/s/Lisbon/homes', ids)).toBe('https://www.airbnb.com/s/Lisbon/homes');
  });

  it('ignores malformed affiliate values instead of sending them', () => {
    const bad = affiliateConfig({ NEXT_PUBLIC_BOOKING_AID: '12 34"><script>', NEXT_PUBLIC_VRBO_AFFILIATE_QUERY: 'javascript:alert(1)' });
    expect(bad).toEqual({ bookingAid: undefined, openTableRef: undefined, vrboQuery: undefined });
  });

  it('says plainly that we don’t book', () => {
    expect(handoffNote('opentable')).toMatch(/doesn’t book/);
  });
});
