'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ONBOARDING_STEPS,
  parseOnboardingStep,
  sanitizeFromPath,
  stepNumberToKey,
  useOnboardingStore,
} from '@/lib/onboarding';
import { track } from '@/lib/analytics';
import { OnboardingView } from './OnboardingView';

const TOTAL_STEPS = ONBOARDING_STEPS.length;

/**
 * Router-aware container for the traveler-lens onboarding at `/welcome`.
 * Keeps the step in `?step=1..5` (so refresh resumes and browser Back moves
 * between steps — UFR-D05) and returns the visitor to `?from=` on completion
 * instead of always landing on `/` (UFR-D13).
 */
export function OnboardingFlow() {
  const router = useRouter();
  const pathname = usePathname() ?? '/welcome';
  const searchParams = useSearchParams();
  const draft = useOnboardingStore();
  const [finished, setFinished] = useState<null | { skipped: boolean }>(null);

  const stepNumber = parseOnboardingStep(searchParams.get('step'));
  const step = stepNumberToKey(stepNumber);
  const fromPath = sanitizeFromPath(searchParams.get('from'));

  const buildStepUrl = useCallback(
    (nextStepNumber: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('step', String(nextStepNumber));
      return `${pathname}?${params.toString()}`;
    },
    [pathname, searchParams],
  );

  // A missing, non-numeric, or out-of-range `step` in the URL is corrected in
  // place (replace, not push) so a bad or hand-edited deep link never traps
  // the visitor and never adds a spurious history entry.
  useEffect(() => {
    const raw = searchParams.get('step');
    if (raw === String(stepNumber)) return;
    router.replace(buildStepUrl(stepNumber));
    // Only the raw query value (via searchParams) should re-trigger this check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!finished) return;
    // Replace, so browser Back from the destination does not reopen the last step.
    const timer = setTimeout(() => router.replace(fromPath), 900);
    return () => clearTimeout(timer);
  }, [finished, fromPath, router]);

  const goToStep = (nextStepNumber: number) => {
    router.push(buildStepUrl(Math.min(Math.max(nextStepNumber, 1), TOTAL_STEPS)));
  };

  const finish = (skipped: boolean) => {
    if (skipped) {
      draft.skip();
      track('onboarding_skipped');
    } else {
      draft.complete();
      track('onboarding_completed', { kind: draft.travelerKind ?? 'unset' });
    }
    setFinished({ skipped });
  };

  return (
    <OnboardingView
      step={step}
      stepNumber={stepNumber}
      totalSteps={TOTAL_STEPS}
      draft={draft}
      onPatch={draft.patch}
      onBack={() => goToStep(stepNumber - 1)}
      onContinue={() => goToStep(stepNumber + 1)}
      onSkip={() => finish(true)}
      onFinish={() => finish(false)}
      finished={finished !== null}
    />
  );
}
