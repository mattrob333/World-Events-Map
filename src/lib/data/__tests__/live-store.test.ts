import { beforeEach, describe, expect, it } from 'vitest';
import { EVENTS } from '../events';
import { useLiveCalendar } from '../live-store';

beforeEach(() => useLiveCalendar.setState({ events: EVENTS, revision: 0, status: 'curated', enrichedAt: null }));
describe('live calendar updates', () => {
  it('invalidates scoring on a signal-only change without changing event counts', () => {
    const changed = EVENTS.map((e, i) => i ? e : { ...e, signals: { ...e.signals, socialMentions: 123456 } });
    useLiveCalendar.getState().apply(changed, [], '2026-09-16T12:00:00Z');
    const state = useLiveCalendar.getState();
    expect(state.events).toHaveLength(EVENTS.length);
    expect(state.revision).toBe(1);
    expect(state.events[0].signals.socialMentions).toBe(123456);
    expect(state.status).toBe('enriched');
    useLiveCalendar.getState().apply(EVENTS, [], null);
    expect(useLiveCalendar.getState().revision).toBe(2);
    expect(useLiveCalendar.getState().status).toBe('curated');
  });
});
