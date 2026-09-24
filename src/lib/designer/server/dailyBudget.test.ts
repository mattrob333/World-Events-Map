import { afterEach, expect, it, vi } from 'vitest';

import { budgetSnapshot, dailyCap, remaining, reserve, resetDailyBudgetsForTests, take } from './dailyBudget';

const NOW = Date.UTC(2026, 8, 24, 12);

afterEach(() => {
  vi.unstubAllEnvs();
  resetDailyBudgetsForTests();
});

it('reads caps from env with safe defaults and splits flights out of the research total', () => {
  expect(dailyCap('research')).toBe(2_000_000);
  expect(dailyCap('researchFlights')).toBe(400_000);
  expect(dailyCap('researchPlace')).toBe(1_600_000);
  vi.stubEnv('TREG_RESEARCH_DAILY_USD', '0.3');
  expect(dailyCap('researchFlights')).toBe(300_000); // never more than the total
  vi.stubEnv('TREG_RESEARCH_DAILY_USD', 'lots');
  expect(dailyCap('research')).toBe(2_000_000);
  vi.stubEnv('JEV_DESIGNER_DAILY_CALLS', '0');
  expect(take('jev', 1, NOW)).toBe(false);
});

it('reserves before the call and settles to the real charge, or the full ceiling when unknown', () => {
  vi.stubEnv('TREG_RESEARCH_DAILY_USD', '0.05');
  const a = reserve(['research'], 20_000, NOW)!;
  const b = reserve(['research'], 20_000, NOW)!;
  expect(reserve(['research'], 20_000, NOW)).toBeNull(); // 60k reserved would pass 50k
  a.settle(1_000);
  b.settle(null);
  a.settle(999_999); // settling twice is a no-op
  expect(budgetSnapshot('research', NOW)).toEqual({ cap: 50_000, spent: 21_000, reserved: 0 });
  expect(remaining('research', NOW)).toBe(29_000);
});

it('is all-or-nothing across pools and resets on the next UTC day', () => {
  vi.stubEnv('TREG_FLIGHTS_DAILY_USD', '0.02');
  expect(reserve(['research', 'researchFlights'], 20_000, NOW)?.settle(null)).toBeUndefined();
  expect(reserve(['research', 'researchFlights'], 20_000, NOW)).toBeNull();
  expect(budgetSnapshot('research', NOW).spent).toBe(20_000); // the refused flight took nothing from the total
  expect(reserve(['research', 'researchFlights'], 20_000, NOW + 86_400_000)).not.toBeNull();
});
