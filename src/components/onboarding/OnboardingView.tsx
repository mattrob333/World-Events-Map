'use client';

import { Button, Chip } from '@/components/ui';
import {
  INTEREST_OPTIONS,
  TRAVELER_KIND_COPY,
  TRAVELER_KINDS,
  type OnboardingDraft,
  type OnboardingStep,
} from '@/lib/onboarding';

const STEP_COPY: Record<OnboardingStep, { title: string; body: string }> = {
  traveler: {
    title: 'What kind of traveler are you — this week?',
    body: 'You can keep more than one mode later.',
  },
  home: {
    title: 'Where do trips usually start?',
    body: 'A region is enough. Airport is optional and stays private unless you publish it later.',
  },
  interests: {
    title: 'What actually pulls you?',
    body: 'Weighted interests come later.',
  },
  mode: {
    title: 'Name a first Travel Mode',
    body: 'A mode is a version of you — Family Ski, Solo Weekend, Work Layover. Not a permanent identity.',
  },
  visibility: {
    title: 'How public should this be?',
    body: 'Private by default. Discoverable does not publish anything on its own.',
  },
};

export type OnboardingDraftFields = Pick<
  OnboardingDraft,
  'travelerKind' | 'homeRegion' | 'homeAirport' | 'interests' | 'modeName' | 'visibility'
>;

export interface OnboardingViewProps {
  step: OnboardingStep;
  /** 1-based, clamped to [1, totalSteps]. */
  stepNumber: number;
  totalSteps: number;
  draft: OnboardingDraftFields;
  onPatch: (partial: Partial<OnboardingDraft>) => void;
  onBack: () => void;
  onContinue: () => void;
  onSkip: () => void;
  onFinish: () => void;
  /** True once the visitor has finished or skipped — shows the honest confirmation state. */
  finished: boolean;
}

/**
 * Presentational onboarding flow. Every promise here must be true today:
 * answers are written only to this browser's `meridian.onboarding.v1`
 * localStorage entry, nothing is published, and nothing here personalizes
 * the rest of the product yet (UFR-D03, UFR-A07). Kept free of `next/navigation`
 * so it renders (and its selected/aria state can be asserted) without a router.
 */
export function OnboardingView({
  step,
  stepNumber,
  totalSteps,
  draft,
  onPatch,
  onBack,
  onContinue,
  onSkip,
  onFinish,
  finished,
}: OnboardingViewProps) {
  if (finished) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
        <p className="label-sm text-brass">Saved</p>
        <h1 className="mt-3 font-display text-3xl text-ink">Saved on this device only.</h1>
        <p className="mt-3 text-[14px] text-ink-muted">Nothing was published. Taking you back…</p>
      </main>
    );
  }

  const isLast = stepNumber >= totalSteps;

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <p className="label-sm text-brass">
        {stepNumber} / {totalSteps}
      </p>
      <h1 className="mt-3 font-display text-4xl text-ink">{STEP_COPY[step].title}</h1>
      <p className="mt-3 text-[14px] text-ink-muted">{STEP_COPY[step].body}</p>
      <p className="mt-1 text-[12px] text-ink-faint">
        Saved on this device only. Nothing is published, and nothing here personalizes dope.travel yet.
      </p>

      {step === 'traveler' && (
        <div className="mt-8 grid gap-2" role="group" aria-label="Traveler kind">
          {TRAVELER_KINDS.map((kind) => {
            const selected = draft.travelerKind === kind;
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={selected}
                onClick={() => onPatch({ travelerKind: kind })}
                className={`glass rounded-[3px] p-4 text-left ${selected ? 'ring-2 ring-inset ring-brass' : ''}`}
              >
                <p className="text-[15px] text-ink">{TRAVELER_KIND_COPY[kind].title}</p>
                <p className="mt-1 text-[12px] text-ink-muted">{TRAVELER_KIND_COPY[kind].body}</p>
              </button>
            );
          })}
        </div>
      )}

      {step === 'home' && (
        <div className="mt-8 grid gap-4">
          <label className="grid gap-1 text-[12px] text-ink-muted">
            Home region
            <input
              value={draft.homeRegion}
              onChange={(event) => onPatch({ homeRegion: event.target.value })}
              className="h-10 border border-ink/15 bg-transparent px-3 text-[14px] text-ink"
              placeholder="Rockies, Southeast, Île-de-France…"
              maxLength={120}
            />
          </label>
          <label className="grid gap-1 text-[12px] text-ink-muted">
            Home airport (optional)
            <input
              value={draft.homeAirport}
              onChange={(event) => onPatch({ homeAirport: event.target.value.toUpperCase() })}
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
                onPatch({ interests: next });
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
            onChange={(event) => onPatch({ modeName: event.target.value })}
            className="h-10 border border-ink/15 bg-transparent px-3 text-[14px] text-ink"
            placeholder={
              draft.travelerKind === 'family'
                ? 'Family ski'
                : draft.travelerKind === 'work'
                  ? 'Work layover'
                  : 'The week I actually want'
            }
            maxLength={120}
          />
        </label>
      )}

      {step === 'visibility' && (
        <div className="mt-8 grid gap-2" role="group" aria-label="Visibility">
          {(['private', 'discoverable'] as const).map((value) => {
            const selected = draft.visibility === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                className={`glass rounded-[3px] p-4 text-left ${selected ? 'ring-2 ring-inset ring-brass' : ''}`}
                onClick={() => onPatch({ visibility: value })}
              >
                <p className="text-[15px] text-ink">{value === 'private' ? 'Private' : 'Discoverable'}</p>
                <p className="mt-1 text-[12px] text-ink-muted">
                  {value === 'private'
                    ? 'Only you. The product still works.'
                    : 'Not published — needs a member account and your confirmation later. Never precise location, never private modes.'}
                </p>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          {stepNumber > 1 && (
            <button type="button" className="text-[12px] text-ink-muted hover:text-ink" onClick={onBack}>
              ‹ Back
            </button>
          )}
          <button type="button" className="text-[12px] text-ink-muted" onClick={onSkip}>
            Skip and enter World
          </button>
        </div>
        {!isLast ? (
          <Button variant="commit" onClick={onContinue}>
            Continue
          </Button>
        ) : (
          <Button variant="commit" onClick={onFinish}>
            Enter World
          </Button>
        )}
      </div>
    </main>
  );
}
