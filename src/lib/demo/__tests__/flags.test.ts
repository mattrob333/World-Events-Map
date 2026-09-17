import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEMO_LABEL, isDemoMode } from '@/lib/flags';

afterEach(() => vi.unstubAllEnvs());

describe('demo flag', () => {
  it.each([
    // Simulation must be explicitly enabled, in every environment.
    ['0', 'production', false],
    ['0', 'development', false],
    ['1', 'production', true],
    ['1', 'development', true],
    [undefined, 'production', false],
    [undefined, 'development', false],
    ['', 'production', false],
    ['', 'test', false],
  ] as const)('flag=%s, NODE_ENV=%s → %s', (flag, nodeEnv, expected) => {
    vi.stubEnv('NEXT_PUBLIC_MERIDIAN_DEMO', flag);
    vi.stubEnv('NODE_ENV', nodeEnv);
    expect(isDemoMode()).toBe(expected);
  });

  it('exports the persistent demo disclosure', () => {
    expect(DEMO_LABEL).toBe('Demo — simulated members and activity');
  });
});
