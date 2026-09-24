import { describe, expect, it } from 'vitest';
import { EVENTS } from '@/lib/data/events';
import type { WorldEvent } from '@/lib/types';
import { whyNow } from './whyNow';

const base = EVENTS[0];
const at = (start: string, end: string, extra: Partial<WorldEvent> = {}): WorldEvent => ({ ...base, start, end, ...extra });

describe('whyNow', () => {
  it('says an event is on now and when it ends, with no plan-by', () => {
    const why = whyNow(at('2026-09-20', '2026-10-04'), '2026-09-24');
    expect(why).toMatchObject({ tone: 'now', when: 'On now · till Oct 4' });
    expect(why.planBy).toBeUndefined();
    expect(whyNow(at('2026-09-20', '2026-09-24'), '2026-09-24').when).toBe('Last day today');
  });

  it('counts down to events starting soon', () => {
    expect(whyNow(at('2026-09-25', '2026-09-27'), '2026-09-24').when).toBe('Starts tomorrow');
    expect(whyNow(at('2026-09-29', '2026-09-30'), '2026-09-24')).toMatchObject({ tone: 'soon', when: 'Starts in 5 days' });
    expect(whyNow(at('2026-11-05', '2026-11-06'), '2026-09-24')).toMatchObject({ tone: 'plan', when: 'In 6 weeks · Nov 5' });
  });

  it('dates the plan-by marker from the editorial booking window', () => {
    // A 40-day window before a Nov 13 start: commit by Oct 4.
    const why = whyNow(at('2026-11-13', '2026-11-15', { bookingLeadDays: 40 }), '2026-09-24');
    expect(why.planBy?.deadline).toBe('2026-10-04');
    expect(why.planBy?.label).toMatch(/Oct 4/);
  });

  it('leaves far-off plan-by dates out and never claims live availability', () => {
    const far = whyNow(at('2027-08-01', '2027-08-03', { bookingLeadDays: 30 }), '2026-09-24');
    expect(far.planBy).toBeUndefined();
    for (const event of EVENTS) {
      const label = whyNow(event, '2026-09-24').planBy?.label ?? '';
      expect(label).not.toMatch(/sold out|filling up|available|seats left/i);
    }
  });

  it('carries the event’s own first reason', () => {
    expect(whyNow(base, '2026-09-24').reason).toBe(base.whyGo[0]);
  });
});
