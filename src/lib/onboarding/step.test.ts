import { describe, expect, it } from 'vitest';
import { ONBOARDING_STEPS } from './types';
import { parseOnboardingStep, stepKeyToNumber, stepNumberToKey } from './step';

describe('parseOnboardingStep', () => {
  it('clamps a below-range value up to the first step', () => {
    expect(parseOnboardingStep('0')).toBe(1);
    expect(parseOnboardingStep('-5')).toBe(1);
  });

  it('clamps an above-range value down to the last step', () => {
    expect(parseOnboardingStep('9')).toBe(ONBOARDING_STEPS.length);
  });

  it('falls back to the first step for a non-numeric value', () => {
    expect(parseOnboardingStep('abc')).toBe(1);
  });

  it('falls back to the first step when the value is missing', () => {
    expect(parseOnboardingStep(null)).toBe(1);
    expect(parseOnboardingStep(undefined)).toBe(1);
  });

  it('keeps an in-range value as-is', () => {
    expect(parseOnboardingStep('3')).toBe(3);
  });

  it('truncates a fractional value', () => {
    expect(parseOnboardingStep('2.9')).toBe(2);
  });
});

describe('step key <-> number', () => {
  it('round-trips every step', () => {
    ONBOARDING_STEPS.forEach((step, i) => {
      expect(stepKeyToNumber(step)).toBe(i + 1);
      expect(stepNumberToKey(i + 1)).toBe(step);
    });
  });

  it('clamps an out-of-range number to a valid step key', () => {
    expect(stepNumberToKey(0)).toBe(ONBOARDING_STEPS[0]);
    expect(stepNumberToKey(99)).toBe(ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1]);
  });
});
