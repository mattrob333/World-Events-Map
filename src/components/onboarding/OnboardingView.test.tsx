import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EMPTY_ONBOARDING } from '@/lib/onboarding';
import { OnboardingView, type OnboardingViewProps } from './OnboardingView';

const noop = () => {};

function renderView(overrides: Partial<OnboardingViewProps> = {}) {
  const props: OnboardingViewProps = {
    step: 'traveler',
    stepNumber: 1,
    totalSteps: 5,
    draft: EMPTY_ONBOARDING,
    onPatch: noop,
    onBack: noop,
    onContinue: noop,
    onSkip: noop,
    onFinish: noop,
    finished: false,
    ...overrides,
  };
  return renderToStaticMarkup(createElement(OnboardingView, props));
}

describe('OnboardingView selected state (UFR-D05)', () => {
  it('marks the chosen traveler kind aria-pressed=true and every sibling false', () => {
    const html = renderView({ draft: { ...EMPTY_ONBOARDING, travelerKind: 'solo' } });
    expect(html).toContain('aria-pressed="true"');
    // 5 traveler kinds total: exactly one true, four false.
    expect(html.match(/aria-pressed="true"/g)?.length).toBe(1);
    expect(html.match(/aria-pressed="false"/g)?.length).toBe(4);
  });

  it('gives the selected traveler card a visible ring the .glass border cannot swallow', () => {
    const html = renderView({ draft: { ...EMPTY_ONBOARDING, travelerKind: 'couple' } });
    expect(html).toContain('ring-2 ring-inset ring-brass');
  });

  it('has no selected state when nothing is chosen yet', () => {
    const html = renderView();
    expect(html.match(/aria-pressed="true"/g)).toBeNull();
    expect(html.match(/aria-pressed="false"/g)?.length).toBe(5);
  });

  it('marks the chosen visibility option aria-pressed=true and the other false', () => {
    const html = renderView({
      step: 'visibility',
      stepNumber: 5,
      draft: { ...EMPTY_ONBOARDING, visibility: 'discoverable' },
    });
    expect(html.match(/aria-pressed="true"/g)?.length).toBe(1);
    expect(html.match(/aria-pressed="false"/g)?.length).toBe(1);
  });
});

describe('OnboardingView honest copy (UFR-D03, UFR-A07)', () => {
  it('never promises to open the product around the visitor', () => {
    const html = renderView();
    expect(html).not.toContain('opens the product around you');
  });

  it('never claims World Heat is being personalized', () => {
    const html = renderView({ step: 'interests', stepNumber: 3 });
    expect(html).not.toContain('World Heat has something to talk to');
  });

  it('states plainly that Discoverable is not published yet', () => {
    const html = renderView({ step: 'visibility', stepNumber: 5 });
    expect(html).toContain('Not published — needs a member account and your confirmation later');
    expect(html).not.toContain('A public portrait later');
  });

  it('discloses on every step that answers are device-local and unpublished', () => {
    for (const step of ['traveler', 'home', 'interests', 'mode', 'visibility'] as const) {
      const html = renderView({ step, stepNumber: 1 });
      expect(html).toContain('Saved on this device only');
    }
  });

  it('shows an honest confirmation instead of silently redirecting on finish', () => {
    const html = renderView({ finished: true });
    expect(html).toContain('Saved on this device only.');
    expect(html).toContain('Nothing was published');
  });
});

describe('OnboardingView input caps (UFR-D12)', () => {
  it('caps the free-text home region field', () => {
    const html = renderView({ step: 'home', stepNumber: 2 });
    expect(html).toMatch(/placeholder="Rockies, Southeast, Île-de-France…"[^>]*maxLength="120"|maxLength="120"[^>]*placeholder="Rockies, Southeast, Île-de-France…"/);
  });

  it('caps the free-text mode name field', () => {
    const html = renderView({ step: 'mode', stepNumber: 4 });
    expect(html).toContain('maxLength="120"');
  });
});

describe('OnboardingView in-flow navigation (UFR-D05, UFR-D13)', () => {
  it('has no Back control on the first step', () => {
    const html = renderView({ stepNumber: 1 });
    expect(html).not.toContain('‹ Back');
  });

  it('shows a Back control from the second step onward', () => {
    const html = renderView({ step: 'home', stepNumber: 2 });
    expect(html).toContain('‹ Back');
  });

  it('offers Continue before the last step and Enter World on the last step', () => {
    const mid = renderView({ stepNumber: 1 });
    expect(mid).toContain('Continue');
    expect(mid).not.toContain('Enter World');

    const last = renderView({ step: 'visibility', stepNumber: 5, totalSteps: 5 });
    expect(last).toContain('Enter World');
    expect(last).not.toContain('Continue');
  });
});
