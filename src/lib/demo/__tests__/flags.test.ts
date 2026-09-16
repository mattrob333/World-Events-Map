import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEMO_LABEL, isDemoMode } from '@/lib/flags';

afterEach(() => vi.unstubAllEnvs());

describe('demo flag', () => {
  it.each([
    // The only thing that turns demo off is an explicit 0. NODE_ENV is irrelevant:
    // the first Vercel build shipped real mode because the host ignored the env
    // file, so the default must not depend on the environment at all.
    ['0', 'production', false],
    ['0', 'development', false],
    ['1', 'production', true],
    ['1', 'development', true],
    [undefined, 'production', true],
    [undefined, 'development', true],
    ['', 'production', true],
    ['', 'test', true],
  ] as const)('flag=%s, NODE_ENV=%s → %s', (flag, nodeEnv, expected) => {
    vi.stubEnv('NEXT_PUBLIC_MERIDIAN_DEMO', flag);
    vi.stubEnv('NODE_ENV', nodeEnv);
    expect(isDemoMode()).toBe(expected);
  });

  it('exports the persistent demo disclosure', () => {
    expect(DEMO_LABEL).toBe('Demo — simulated members and activity');
  });
});
