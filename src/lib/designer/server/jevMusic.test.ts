import { afterEach, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { budgetSnapshot, resetDailyBudgetsForTests } from './dailyBudget';
import { jevBudgetAvailable, jevEventFit, jevPersona } from './jevMusic';

afterEach(() => {
  vi.unstubAllEnvs();
  resetDailyBudgetsForTests();
});

const summary = { topArtists: ['Tom Petty'], genres: ['classic rock'], eras: ['1970s'] };
const event = (id: string) => ({ id, source: 'ticketmaster' as const, kind: 'tribute' as const, name: `Show ${id}`, date: '2026-11-01', url: `https://www.ticketmaster.com/e/${id}` });

it('charges the daily Jev budget once per upstream request and stops at the cap', async () => {
  vi.stubEnv('TYPESAFE_API_KEY', 'test-key');
  vi.stubEnv('JEV_DESIGNER_DAILY_CALLS', '3');
  const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ model: 'jev-1', answers: { fit: { type: 'score', score: 3 } } }))) as unknown as typeof fetch;
  const fit = await jevEventFit(summary, ['a', 'b', 'c', 'd', 'e', 'f'].map(event), fetchImpl);
  expect(fetchImpl).toHaveBeenCalledTimes(3);
  expect(fit.size).toBe(3); // the rest keep no score rather than a guessed one
  expect(budgetSnapshot('jev').spent).toBe(3);
  expect(jevBudgetAvailable()).toBe(false);
  expect(await jevPersona(summary, fetchImpl)).toBeNull();
  expect(fetchImpl).toHaveBeenCalledTimes(3);
});
