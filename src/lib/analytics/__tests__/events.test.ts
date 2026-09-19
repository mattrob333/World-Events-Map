import { describe, expect, it, vi } from 'vitest';
import { PRODUCT_EVENTS, setAnalyticsAdapter, track } from '../events';

describe('product analytics contract', () => {
  it('covers the overnight event list', () => {
    expect(PRODUCT_EVENTS).toContain('destination_opened');
    expect(PRODUCT_EVENTS).toContain('inspiration_voted');
    expect(PRODUCT_EVENTS).toContain('access_inquiry_sent');
  });

  it('does not throw when the adapter is a no-op', () => {
    const spy = vi.fn();
    setAnalyticsAdapter({ track: spy });
    track('world_opened', { surface: 'home' });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].name).toBe('world_opened');
    expect(spy.mock.calls[0][0].properties).not.toHaveProperty('email');
  });
});
