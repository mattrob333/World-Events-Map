'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Chip } from '@/components/ui';
import {
  INTEREST_OPTIONS,
  ONBOARDING_STEPS,
  TRAVELER_KIND_COPY,
  TRAVELER_KINDS,
  useOnboardingStore,
  type OnboardingStep,
} from '@/lib/onboarding';
import { track } from '@/lib/analytics';

const STEP_COPY: Record<OnboardingStep, { title: string; body: string }> = {
  traveler: {
    title: 'What kind of traveler are you — this week?',
    body: 'You can keep more than one mode later. This just opens the product around you.',
  },
  home: {
    title: 'Where do trips usually start?',
    body: 'A region is enough. Airport is optional and stays private unless you publish it later.',
  },
  interests: {
    title: 'What actually pulls you?',
    body: 'Weighted interests come later. Pick a few so World Heat has something to talk to.',
  },
  mode: {
    title: 'Name a first Travel Mode',
    body: 'A mode is a version of you — Family Ski, Solo Weekend, Work Layover. Not a permanent identity.',
  },
  visibility: {
    title: 'How public should this be?',
    body: 'Private by default. Discoverable never publishes precise location, private modes, or private Circles.',
  },
};

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>('traveler');
  const draft = useOnboardingStore();
  const index = ONBOARDING_STEPS.indexOf(step);

  const finish = (skipped: boolean) => {
    if (skipped) {
      draft.skip();
      track('onboarding_skipped');
    } else {
      draft.complete();
      track('onboarding_completed', { kind: draft.travelerKind ?? 'unset' });
    }
    router.push('/');
  };

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <p className="label-sm text-brass">
        {index + 1} / {ONBOARDING_STEPS.length}
      </p>
      <h1 className="mt-3 font-display text-4xl text-ink">{STEP_COPY[step].title}</h1>
      <p className="mt-3 text-[14px] text-ink-muted">{STEP_COPY[step].body}</p>

      {step === 'traveler' && (
        <div className="mt-8 grid gap-2">
          {TRAVELER_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => draft.patch({ travelerKind: kind })}
              className={`glass rounded-[3px] p-4 text-left ${draft.travelerKind === kind ? 'border-brass' : ''}`}
            >
              <p className="text-[15px] text-ink">{TRAVELER_KIND_COPY[kind].title}</p>
              <p className="mt-1 text-[12px] text-ink-muted">{TRAVELER_KIND_COPY[kind].body}</p>
            </button>
          ))}
        </div>
      )}

      {step === 'home' && (
        <div className="mt-8 grid gap-4">
          <label className="grid gap-1 text-[12px] text-ink-muted">
            Home region
            <input
              value={draft.homeRegion}
              onChange={(event) => draft.patch({ homeRegion: event.target.value })}
              className="h-10 border border-ink/15 bg-transparent px-3 text-[14px] text-ink"
              placeholder="Rockies, Southeast, Île-de-France…"
            />
          </label>
          <label className="grid gap-1 text-[12px] text-ink-muted">
            Home airport (optional)
            <input
              value={draft.homeAirport}
              onChange={(event) => draft.patch({ homeAirport: event.target.value.toUpperCase() })}
              className="h-10 border border-ink/15 bg-transparent px-3 text-[14px] text-ink"
              placeholder="KASE"
              maxLength={4}
            />
          </label>
        </div>
      )}

      {step === 'interests' && (
        <div className="mt-8 flex flex-wrap gap-2">
          {INTEREST_OPTIONS.map((interest) => (
            <Chip
              key={interest}
              active={draft.interests.includes(interest)}
              onClick={() => {
                const next = draft.interests.includes(interest)
                  ? draft.interests.filter((item) => item !== interest)
                  : [...draft.interests, interest];
                draft.patch({ interests: next });
              }}
            >
              {interest}
            </Chip>
          ))}
        </div>
      )}

      {step === 'mode' && (
        <label className="mt-8 grid gap-1 text-[12px] text-ink-muted">
          Mode name
          <input
            value={draft.modeName}
            onChange={(event) => draft.patch({ modeName: event.target.value })}
            className="h-10 border border-ink/15 bg-transparent px-3 text-[14px] text-ink"
            placeholder={
              draft.travelerKind === 'family'
                ? 'Family ski'
                : draft.travelerKind === 'work'
                  ? 'Work layover'
                  : 'The week I actually want'
            }
          />
        </label>
      )}

      {step === 'visibility' && (
        <div className="mt-8 grid gap-2">
          {(['private', 'discoverable'] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={`glass rounded-[3px] p-4 text-left ${draft.visibility === value ? 'border-brass' : ''}`}
              onClick={() => draft.patch({ visibility: value })}
            >
              <p className="text-[15px] text-ink">{value === 'private' ? 'Private' : 'Discoverable'}</p>
              <p className="mt-1 text-[12px] text-ink-muted">
                {value === 'private'
                  ? 'Only you. The product still works.'
                  : 'A public portrait later — never precise location, never private modes.'}
              </p>
            </button>
          ))}
        </div>
      )}

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="text-[12px] text-ink-muted" onClick={() => finish(true)}>
          Skip and enter World
        </button>
        {index < ONBOARDING_STEPS.length - 1 ? (
          <Button
            variant="commit"
            onClick={() => setStep(ONBOARDING_STEPS[index + 1]!)}
          >
            Continue
          </Button>
        ) : (
          <Button variant="commit" onClick={() => finish(false)}>
            Enter World
          </Button>
        )}
      </div>
    </main>
  );
}
