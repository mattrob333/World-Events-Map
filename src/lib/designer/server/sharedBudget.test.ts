import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
let dbAvailable = true;
// Like the Supabase builder: awaitable, with .abortSignal() returning the same result.
const client = {
  rpc: (...args: unknown[]) => {
    const result = Promise.resolve(rpc(...args));
    return Object.assign(result, { abortSignal: () => result });
  },
};
vi.mock('@/lib/data/durable', () => ({ signalDatabase: () => (dbAvailable ? client : null) }));

const { takeShared, reserveShared } = await import('./sharedBudget');
const { resetDailyBudgetsForTests } = await import('./dailyBudget');

describe('shared daily budgets', () => {
  beforeEach(() => {
    resetDailyBudgetsForTests();
    rpc.mockReset();
    dbAvailable = true;
  });
  afterEach(() => vi.unstubAllEnvs());

  it('goes ahead only when the shared ledger grants the claim', async () => {
    rpc.mockResolvedValueOnce({ data: '2026-09-26', error: null });
    expect(await takeShared('voice')).toBe(true);
    rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await takeShared('voice')).toBe(false);
    expect(rpc).toHaveBeenCalledWith('claim_meridian_daily_budget', expect.objectContaining({ p_pool: 'voice', p_units: 1 }));
  });

  it('fails closed in production when the ledger is unreachable, open elsewhere', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'relation does not exist' } });
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(await takeShared('designerAi')).toBe(false);
    dbAvailable = false;
    expect(await takeShared('designerAi')).toBe(false);
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect(await takeShared('designerAi')).toBe(true);
  });

  it('refunds the unused part of a reservation to the day it was claimed', async () => {
    rpc.mockImplementation(async (name: string) => (name === 'claim_meridian_daily_budget' ? { data: '2026-09-26', error: null } : { data: null, error: null }));
    const reservation = await reserveShared(['research', 'researchPlace'], 500_000);
    expect(reservation).not.toBeNull();
    reservation!.settle(200_000);
    await vi.waitFor(() => expect(rpc.mock.calls.filter(([name]) => name === "refund_meridian_daily_budget")).toHaveLength(2));
    const refunds = rpc.mock.calls.filter(([name]) => name === 'refund_meridian_daily_budget');
    expect(refunds.map(([, args]) => args)).toEqual([
      { p_pool: 'research', p_units: 300_000, p_day: '2026-09-26' },
      { p_pool: 'researchPlace', p_units: 300_000, p_day: '2026-09-26' },
    ]);
  });

  it('undoes earlier pools when a later pool refuses', async () => {
    rpc
      .mockResolvedValueOnce({ data: '2026-09-26', error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValue({ data: null, error: null });
    expect(await reserveShared(['research', 'researchFlights'], 100_000)).toBeNull();
    expect(rpc).toHaveBeenCalledWith('refund_meridian_daily_budget', { p_pool: 'research', p_units: 100_000, p_day: '2026-09-26' });
  });
});
