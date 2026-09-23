import { expect, it } from 'vitest';
import { buildResearchPlan, RESEARCH_TARGETS } from './plan';

it('uses a fixed, bounded rotation of curated destinations and query categories', () => {
  const plans = [0, 1, 2].map((day) => buildResearchPlan(new Date(Date.UTC(2026, 8, 22 + day, 5))));
  expect(plans.flatMap((plan) => plan.exaQueries)).toHaveLength(12);
  expect(plans.every((plan) => plan.exaQueries.length === 4 && plan.tregTasks.length === 2)).toBe(true);
  expect(new Set(plans.flatMap((plan) => plan.tregTasks.map((task) => task.destinationSlug))).size).toBe(RESEARCH_TARGETS.length);
  expect(plans[0].startPublishedDate).toBe('2026-08-23T05:00:00.000Z');
});
