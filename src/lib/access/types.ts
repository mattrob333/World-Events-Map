export const OPPORTUNITY_KINDS = [
  'stay',
  'aviation',
  'ground',
  'event_access',
  'dining',
  'experience',
  'yacht',
  'advisor',
] as const;

export type OpportunityKind = (typeof OPPORTUNITY_KINDS)[number];

export const AVAILABILITY_STATES = ['request', 'provider_updated'] as const;
export type AvailabilityState = (typeof AVAILABILITY_STATES)[number];

export interface OpportunityCard {
  id: string;
  kind: OpportunityKind;
  title: string;
  subtitle: string;
  destinationId: string;
  destinationLabel: string;
  eventId?: string;
  providerName: string;
  priceLabel: string;
  availability: AvailabilityState;
  availabilityLabel: string;
  windowLabel?: string;
  body: string;
  href: string;
  /** Preview fixtures are samples: no provider stands behind them. */
  sample: boolean;
}

export const OPPORTUNITY_KIND_LABEL: Record<OpportunityKind, string> = {
  stay: 'Stay',
  aviation: 'Private aviation',
  ground: 'Ground transport',
  event_access: 'Event access',
  dining: 'Dining',
  experience: 'Local experience',
  yacht: 'Yacht / boat',
  advisor: 'Travel advisor',
};

/** Shown on every sample card. A sample must never claim a provider action. */
export const SAMPLE_OFFER_NOTE =
  'Sample listing for the product preview. No provider has confirmed these details and nothing is held.';

export const AVAILABILITY_COPY: Record<AvailabilityState, string> = {
  request: 'Availability by request. This is an inquiry, not a confirmed hold.',
  provider_updated: 'Details last confirmed by the provider. Still an inquiry until they reply.',
};

/** Every card states its window; undated samples say so instead of implying now. */
export function offerWindowLabel(offer: Pick<OpportunityCard, 'windowLabel'>): string {
  return offer.windowLabel ?? 'Dates on request';
}
