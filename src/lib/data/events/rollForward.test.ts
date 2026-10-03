import { describe, expect, it } from 'vitest';
import type { WorldEvent } from '@/lib/types';
import { EVENTS } from './index';
import { rollForward, sameWindow } from './rollForward';
import { formatEventDates } from '@/components/ui/tokens';
import { whyNow } from '@/lib/discovery/whyNow';
import { isHappeningToday } from '@/lib/data/scene-time';
import { bookingAlertFor } from '@/lib/alerts/engine';

const base = EVENTS[0]!;
const ev = (over: Partial<WorldEvent>): WorldEvent => ({ ...base, datesStatus: undefined, ...over });

describe('rolling recurring events forward', () => {
  it('keeps a weekend on its weekday and a fixed date on its date', () => {
    // Fri 2026-07-31 → the nearest Friday a year on.
    expect(new Date(`${sameWindow('2026-07-31', 1)}T00:00:00Z`).getUTCDay()).toBe(5);
    expect(sameWindow('2026-07-31', 1)).toBe('2027-07-30');
    // Tue 22 Sep stays the 22nd.
    expect(sameWindow('2026-09-22', 1)).toBe('2027-09-22');
    expect(sameWindow('2028-02-29', 1)).toBe('2029-02-28');
  });

  it('brings an ended annual or biennial event back as its projected next edition', () => {
    const annual = rollForward(ev({ id: 'x', start: '2026-08-07', end: '2026-08-16', recurrence: 'annual' }), '2026-10-03');
    expect(annual).toMatchObject({ id: 'x', datesStatus: 'projected', start: '2027-08-06', end: '2027-08-15' });
    const biennial = rollForward(ev({ id: 'y', start: '2026-09-22', end: '2026-09-27', recurrence: 'biennial' }), '2026-10-03');
    expect(biennial.start.slice(0, 4)).toBe('2028');
  });

  it('leaves upcoming, one-off and season-edition events alone', () => {
    const coming = ev({ start: '2026-12-01', end: '2026-12-05', recurrence: 'annual' });
    expect(rollForward(coming, '2026-10-03')).toBe(coming);
    const once = ev({ start: '2026-08-01', end: '2026-08-02', recurrence: 'one-off' });
    expect(rollForward(once, '2026-10-03')).toBe(once);
    const season = ev({ id: 'milan-fashion-week-ss27', start: '2026-09-22', end: '2026-09-28', recurrence: 'seasonal' });
    expect(rollForward(season, '2026-10-03')).toBe(season);
  });

  it('never clones a rotating host or an edition-named event', () => {
    const cup = ev({ id: 'presidents-cup', start: '2026-09-22', end: '2026-09-27', recurrence: 'biennial' });
    expect(rollForward(cup, '2026-10-03')).toBe(cup);
    const numbered = ev({ id: 'z', name: 'Sharjah Biennial 17', start: '2026-02-01', end: '2026-06-01', recurrence: 'biennial' });
    expect(rollForward(numbered, '2026-10-03')).toBe(numbered);
    const dated = ev({ id: 'w', name: "The World's 50 Best Restaurants 2026", start: '2026-06-01', end: '2026-06-01', recurrence: 'annual' });
    expect(rollForward(dated, '2026-10-03')).toBe(dated);
    expect(rollForward(ev({ id: 'd', name: 'Defqon.1', start: '2026-06-25', end: '2026-06-28', recurrence: 'annual' }), '2026-10-03').datesStatus).toBe('projected');
  });

  it('gives a projected edition no countdown, plan-by or live state', () => {
    const projected = rollForward(ev({ id: 'x', start: '2026-08-07', end: '2026-08-16', recurrence: 'annual' }), '2026-10-03');
    expect(whyNow(projected, '2027-07-01')).toEqual({ tone: 'later', when: 'Usually early Aug 2027 · dates TBA', reason: projected.whyGo[0] });
    expect(isHappeningToday(projected, new Date(`${projected.start}T12:00:00Z`))).toBe(false);
    expect(bookingAlertFor(projected, '2027-07-01').headline).toMatch(/not announced yet/);
  });

  it('says plainly when dates are not announced', () => {
    expect(formatEventDates({ start: '2027-07-30', end: '2027-08-01', datesStatus: 'projected' })).toBe('Usually late Jul 2027 · dates TBA');
    expect(formatEventDates({ start: '2027-07-30', end: '2027-08-01' })).not.toMatch(/TBA/);
  });

  it('keeps every recurring series in the live calendar', () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const event of EVENTS) {
      if (event.datesStatus === 'projected') expect(event.end >= today, event.id).toBe(true);
    }
  });
});
