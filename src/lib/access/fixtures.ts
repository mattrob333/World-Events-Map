import type { OpportunityCard } from './types';

export const ACCESS_FIXTURE_DISCLOSURE =
  'Sample partner opportunities for product preview. Nothing here is live inventory or a confirmed reservation.';

export const OPPORTUNITY_FIXTURES: OpportunityCard[] = [
  {
    id: 'opp-aspen-nell',
    kind: 'stay',
    title: 'Base-of-Ajax suite week',
    subtitle: 'Aspen · 19 Dec – 3 Jan',
    destinationId: 'aspen|US',
    destinationLabel: 'Aspen',
    eventId: 'aspen-christmas-week',
    providerName: 'High Country Houses',
    priceLabel: 'On request',
    availability: 'request',
    availabilityLabel: 'Availability by request',
    windowLabel: '19 Dec 2026 – 3 Jan 2027',
    body: 'A ski-in residence opposite the gondola. In a connected service your dates would go to the provider. No rooms are held until they confirm.',
    sample: true,
    href: '/access?offer=opp-aspen-nell',
  },
  {
    id: 'opp-ase-kase',
    kind: 'aviation',
    title: 'Reposition into KASE',
    subtitle: 'TEB → ASE · heavy-jet window',
    destinationId: 'aspen|US',
    destinationLabel: 'Aspen',
    eventId: 'aspen-christmas-week',
    providerName: 'Ridge Line Aviation',
    priceLabel: 'Empty-leg inquiry',
    availability: 'request',
    availabilityLabel: 'Reposition inquiry',
    windowLabel: 'Holiday fortnight',
    body: 'A possible reposition into Aspen/Pitkin during the holiday rush. Slots and crew duty are operator-controlled. This is not a quote.',
    sample: true,
    href: '/access?offer=opp-ase-kase',
  },
  {
    id: 'opp-aspen-ground',
    kind: 'ground',
    title: 'Airport to mountain',
    subtitle: 'KASE → Ajax plaza',
    destinationId: 'aspen|US',
    destinationLabel: 'Aspen',
    providerName: 'Roaring Fork Meet',
    priceLabel: 'On request',
    availability: 'request',
    availabilityLabel: 'Availability by request',
    body: 'Private meet-and-carry from the FBO. Winter road timing varies; the provider confirms the vehicle, not MERIDIAN.',
    sample: true,
    href: '/access?offer=opp-aspen-ground',
  },
  {
    id: 'opp-monaco-harbor',
    kind: 'yacht',
    title: 'Harbor morning, Grand Prix week',
    subtitle: 'Port Hercules',
    destinationId: 'monte-carlo|MC',
    destinationLabel: 'Monte-Carlo',
    eventId: 'monaco-grand-prix',
    providerName: 'Riviera Deck',
    priceLabel: 'On request',
    availability: 'request',
    availabilityLabel: 'Availability by request',
    windowLabel: 'Grand Prix week · dates on request',
    body: 'A berth-adjacent morning on the water during the Grand Prix. Race-week access is controlled by the harbor and the operator. Inquiry only.',
    sample: true,
    href: '/access?offer=opp-monaco-harbor',
  },
  {
    id: 'opp-courchevel-chalet',
    kind: 'stay',
    title: 'Bellecôte chalet week',
    subtitle: 'Courchevel 1850',
    destinationId: 'courchevel|FR',
    destinationLabel: 'Courchevel',
    eventId: 'courchevel-peak-week',
    providerName: 'Three Valleys Desk',
    priceLabel: 'On request',
    availability: 'request',
    availabilityLabel: 'Cancellation-list inquiry',
    windowLabel: '19 Dec 2026 – 3 Jan 2027',
    body: 'Cancellation-list inquiry for a ski-in chalet. Staffing and beds are not held by MERIDIAN.',
    sample: true,
    href: '/access?offer=opp-courchevel-chalet',
  },
];

export function listOpportunities(destinationId?: string): OpportunityCard[] {
  if (!destinationId) return OPPORTUNITY_FIXTURES;
  return OPPORTUNITY_FIXTURES.filter((item) => item.destinationId === destinationId);
}

export function getOpportunity(id: string): OpportunityCard | undefined {
  return OPPORTUNITY_FIXTURES.find((item) => item.id === id);
}
