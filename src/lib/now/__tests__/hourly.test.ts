import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ claim: vi.fn(), dayForecast: vi.fn() }));
vi.mock('../service', () => ({ claimVenueSearch: mocks.claim }));
vi.mock('@/lib/opportunities/besttime', () => ({ BestTimeVenueProvider: class { dayForecast = mocks.dayForecast; } }));

const { bestTimeDay, hourlyForArea, resetHourlyCacheForTests } = await import('../hourly');
const { NowSearchBudgetError } = await import('../providerBudget');

describe('bestTimeDay', () => {
  it('counts the small hours as the night before, Monday = 0', () => {
    expect(bestTimeDay(4, 22)).toBe(4); // Friday 10pm → Friday
    expect(bestTimeDay(5, 1)).toBe(4); // Saturday 1am → still Friday night
    expect(bestTimeDay(0, 3)).toBe(6); // Monday 3am → Sunday night
    expect(bestTimeDay(0, 6)).toBe(0);
  });
});

describe('hourlyForArea budgets', () => {
  const center = { lat: 41.26, lng: -95.93 };
  const day = new Map([['v-1', Array.from({ length: 24 }, () => 40)]]);
  const charge = { take: vi.fn(async () => true), refund: vi.fn(async () => undefined) };

  beforeEach(() => {
    vi.stubEnv('BESTTIME_API_KEY_PRIVATE', 'k');
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    mocks.claim.mockReset().mockResolvedValue(undefined);
    mocks.dayForecast.mockReset().mockResolvedValue({ hourly: day, shape: {} });
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); resetHourlyCacheForTests(); });

  it('claims the venue-search budgets (member and site) before the call, once per area', async () => {
    expect(await hourlyForArea(center, 2409, 'drinks', 4, charge)).toBe(day);
    expect(await hourlyForArea(center, 2409, 'drinks', 4, charge)).toBe(day);
    expect(mocks.claim).toHaveBeenCalledTimes(1);
    expect(mocks.claim).toHaveBeenCalledWith(charge);
    expect(mocks.dayForecast).toHaveBeenCalledTimes(1);
  });

  it('out of budget: no call, the chart is left off, and nothing is remembered', async () => {
    mocks.claim.mockRejectedValueOnce(new NowSearchBudgetError('site'));
    expect(await hourlyForArea(center, 2409, 'food', 4, charge)).toBeNull();
    expect(mocks.dayForecast).not.toHaveBeenCalled();
    expect(await hourlyForArea(center, 2409, 'food', 4, charge)).toBe(day);
  });

  it('one member out of searches doesn’t leave another member’s chart off', async () => {
    mocks.claim.mockRejectedValueOnce(new NowSearchBudgetError('member'));
    const [spent, fresh] = await Promise.all([hourlyForArea(center, 2409, 'music', 4, charge), hourlyForArea(center, 2409, 'music', 4, charge)]);
    expect(spent).toBeNull();
    expect(fresh).toBe(day);
    expect(mocks.dayForecast).toHaveBeenCalledTimes(1);
  });
});
