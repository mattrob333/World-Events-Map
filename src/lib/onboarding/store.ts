'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { EMPTY_ONBOARDING, type OnboardingDraft } from './types';

interface OnboardingState extends OnboardingDraft {
  hydrateReady: boolean;
  patch: (partial: Partial<OnboardingDraft>) => void;
  skip: () => void;
  complete: () => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      ...EMPTY_ONBOARDING,
      hydrateReady: false,
      patch: (partial) => set(partial),
      skip: () => set({ skipped: true, completed: true }),
      complete: () => set({ completed: true, skipped: false }),
      reset: () => set({ ...EMPTY_ONBOARDING, hydrateReady: true }),
    }),
    {
      name: 'meridian.onboarding.v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        travelerKind: state.travelerKind,
        homeRegion: state.homeRegion,
        homeAirport: state.homeAirport,
        interests: state.interests,
        modeName: state.modeName,
        visibility: state.visibility,
        completed: state.completed,
        skipped: state.skipped,
      }),
    },
  ),
);
