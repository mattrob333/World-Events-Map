import { Suspense } from 'react';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';

export default function WelcomePage() {
  return (
    <Suspense fallback={<main className="px-4 py-16 text-ink-muted">Opening your traveler lens…</main>}>
      <OnboardingFlow />
    </Suspense>
  );
}
