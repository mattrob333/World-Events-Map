import { describe, expect, it } from 'vitest';
import type { IntentRecord } from '@/lib/intent/types';
import { byId } from '../activities';
import { ACTIVITIES } from '../data';
import { wishlistRows, windowMonths } from '../wishlist';

const NOW = new Date(2026, 8, 28); // Sep 28 2026
const save = (kind: IntentRecord['kind'], id: string, verb: IntentRecord['verb'] = 'save'): IntentRecord => ({
  verb, kind, id, label: id, href: `/x/${id}`, createdAt: '2026-09-01T00:00:00Z',
});
const spots = byId(ACTIVITIES);

describe('wishlistRows', () => {
  it('lays hearted spots on a year from this month, soonest good time first', () => {
    const rows = wishlistRows(
      [save('spot', 'aspen-snowmass-us'), save('spot', 'yellowstone-us'), save('spot', 'nope-xx'), save('destination', 'lisbon')],
      spots,
      new Map(),
      NOW,
    );
    expect(rows.map((r) => r.key)).toEqual(['spot:yellowstone-us', 'spot:aspen-snowmass-us']);
    const aspen = rows[1];
    expect(aspen.months).toHaveLength(12);
    // Sep is column 0: Aspen is off until Dec (column 3), its best months.
    expect(aspen.months!.slice(0, 3)).toEqual(['off', 'off', 'off']);
    expect(aspen.months![3]).not.toBe('off');
    expect(aspen.soon).toBe(3);
    expect(aspen.href).toBe('/?spot=aspen-snowmass-us');
    expect(aspen.when).toBe('From Dec');
    expect(rows[0].when).toBe('Good now');
    expect(aspen.detail).toMatch(/^Opens in about/);
  });

  it('puts events on their dates and leaves out past or far-off saved events', () => {
    const events = new Map([
      ['soon', { id: 'soon', name: 'Soon Fest', city: 'Austin', start: '2026-10-10', end: '2026-10-12' }],
      ['past', { id: 'past', name: 'Old Fest', city: 'Austin', start: '2026-01-10', end: '2026-01-12' }],
      ['far', { id: 'far', name: 'Far Fest', city: 'Austin', start: '2028-01-10', end: '2028-01-12' }],
    ]);
    const rows = wishlistRows([save('event', 'soon'), save('event', 'past'), save('event', 'far'), save('event', 'soon', 'watch')], spots, events, NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0].span!.from).toBeGreaterThan(1);
    expect(rows[0].span!.from).toBeLessThan(1.4);
    expect(rows[0].when).toBe('Oct 10 to Oct 12');
    expect(rows[0].href).toBe('/x/soon');
  });

  it('labels the window months from this one, marking a new year', () => {
    const m = windowMonths(NOW);
    expect(m[0].label).toBe('Sep');
    expect(m[4]).toEqual({ label: 'Jan', year: 2027 });
  });
});
