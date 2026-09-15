import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEMO_LABEL, isDemoMode } from '@/lib/flags';

afterEach(() => vi.unstubAllEnvs());

describe('demo flag', () => {
  it.each([
    ['1', 'production', true],
    ['1', 'development', true],
    ['0', 'production', false],
    ['0', 'development', false],
    [undefined, 'development', true],
    [undefined, 'production', false],
    ['', 'development', true],
    ['', 'production', false],
  ] as const)('flag=%s, NODE_ENV=%s → %s', (flag, nodeEnv, expected) => {
    vi.stubEnv('NEXT_PUBLIC_MERIDIAN_DEMO', flag);
    vi.stubEnv('NODE_ENV', nodeEnv);
    expect(isDemoMode()).toBe(expected);
  });

  it('exports the persistent demo disclosure', () => {
    expect(DEMO_LABEL).toBe('Demo — simulated members and activity');
  });
});
