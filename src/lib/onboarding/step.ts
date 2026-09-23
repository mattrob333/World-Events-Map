import { ONBOARDING_STEPS, type OnboardingStep } from './types';

export const TOTAL_ONBOARDING_STEPS = ONBOARDING_STEPS.length;

/**
 * Reads the `?step=` query value and clamps it to a valid 1-based step
 * number. Missing, non-numeric, or out-of-range values fall back to the
 * nearest valid step (1 for anything below range or unparseable, the last
 * step for anything above) rather than silently restarting the flow.
 */
export function parseOnboardingStep(raw: string | null | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(Math.trunc(n), 1), TOTAL_ONBOARDING_STEPS);
}

/** Converts a clamped 1-based step number to its step key. */
export function stepNumberToKey(stepNumber: number): OnboardingStep {
  const clamped = Math.min(Math.max(Math.trunc(stepNumber), 1), TOTAL_ONBOARDING_STEPS);
  return ONBOARDING_STEPS[clamped - 1]!;
}

/** Converts a step key back to its 1-based step number. */
export function stepKeyToNumber(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step) + 1;
}
