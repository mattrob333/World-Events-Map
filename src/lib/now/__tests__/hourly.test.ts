import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { bestTimeDay } = await import('../hourly');

describe('bestTimeDay', () => {
  it('counts the small hours as the night before, Monday = 0', () => {
    expect(bestTimeDay(4, 22)).toBe(4); // Friday 10pm → Friday
    expect(bestTimeDay(5, 1)).toBe(4); // Saturday 1am → still Friday night
    expect(bestTimeDay(0, 3)).toBe(6); // Monday 3am → Sunday night
    expect(bestTimeDay(0, 6)).toBe(0);
  });
});
