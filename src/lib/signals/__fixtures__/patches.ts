import type { BuzzSignals } from '@/lib/types';

/**
 * Synthetic adapter outputs for tests.
 * These numbers are not live readings, attendance, prices, or social heat.
 */
export const SYNTHETIC_PATCHES: Record<string, Partial<BuzzSignals>> = {
  ticketmaster: { bookingPressure: 0.42, exclusivity: 0.5 },
  predicthq: { searchInterest: 61, bookingPressure: 0.33 },
  x: { socialMentions: 120, socialVelocity: 0.25 },
  'google-trends': { searchInterest: 40, socialVelocity: -0.1 },
  amadeus: { bookingPressure: 0.7 },
  curated: {
    socialMentions: 10,
    socialVelocity: 0,
    searchInterest: 20,
    mediaMentions: 4,
    bookingPressure: 0.2,
    exclusivity: 0.8,
  },
};
