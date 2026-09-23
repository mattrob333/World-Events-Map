import type { InspirationItem, PersonSummary } from './types';

/** Editorial names for the sample board. Not live members. */
export const EDITORIAL_SAVERS: Record<string, PersonSummary> = {
  mara: {
    id: 'editorial-mara',
    handle: 'mara',
    displayName: 'Mara Ellison',
    avatarSeed: 'mara-ellison',
    homeLabel: 'Denver',
    source: 'editorial_fixture',
  },
  nico: {
    id: 'editorial-nico',
    handle: 'nico',
    displayName: 'Nico Varela',
    avatarSeed: 'nico-varela',
    homeLabel: 'Miami',
    source: 'editorial_fixture',
  },
  jules: {
    id: 'editorial-jules',
    handle: 'jules',
    displayName: 'Jules Hartmann',
    avatarSeed: 'jules-hartmann',
    homeLabel: 'Zurich',
    source: 'editorial_fixture',
  },
};

const aspen: InspirationItem[] = [
  {
    id: 'insp-aspen-nell',
    kind: 'stay',
    title: 'The Little Nell',
    subtitle: 'Base of Ajax · holiday week',
    canonicalUrl: 'https://www.thelittlenell.com/',
    sourceLabel: 'Hotel site',
    imageLabel: 'Stay',
    savedBy: EDITORIAL_SAVERS.mara,
    votes: { mustDo: 4, maybe: 1, skip: 0 },
    category: 'Stay',
    destinationId: 'aspen|US',
    createdAt: '2026-08-12',
  },
  {
    id: 'insp-aspen-cloud-nine',
    kind: 'restaurant',
    title: 'Cloud Nine Alpine Bistro',
    subtitle: 'Aspen Highlands afternoon service',
    sourceLabel: 'Editorial note',
    imageLabel: 'Table',
    savedBy: EDITORIAL_SAVERS.jules,
    votes: { mustDo: 5, maybe: 0, skip: 0 },
    category: 'Dining',
    destinationId: 'aspen|US',
    createdAt: '2026-08-18',
    note: 'Booked out weeks ahead in the holiday window — treat as a request, not a hold.',
  },
  {
    id: 'insp-aspen-ajax',
    kind: 'bar',
    title: 'Ajax Tavern',
    subtitle: 'Gondola plaza',
    sourceLabel: 'Editorial note',
    imageLabel: 'Après',
    savedBy: EDITORIAL_SAVERS.nico,
    votes: { mustDo: 2, maybe: 3, skip: 0 },
    category: 'Après',
    destinationId: 'aspen|US',
    createdAt: '2026-08-20',
  },
  {
    id: 'insp-aspen-bowl',
    kind: 'experience',
    title: 'Highlands Bowl hike',
    subtitle: 'When avalanche control allows',
    sourceLabel: 'Editorial note',
    imageLabel: 'Mountain',
    savedBy: EDITORIAL_SAVERS.mara,
    votes: { mustDo: 3, maybe: 2, skip: 1 },
    category: 'Ski',
    destinationId: 'aspen|US',
    createdAt: '2026-08-22',
  },
  {
    id: 'insp-aspen-guide',
    kind: 'article',
    title: 'Four mountains, one town',
    subtitle: 'Why Aspen is not a base village',
    sourceLabel: 'MERIDIAN editorial',
    imageLabel: 'Read',
    savedBy: EDITORIAL_SAVERS.jules,
    votes: { mustDo: 1, maybe: 2, skip: 0 },
    category: 'Research',
    destinationId: 'aspen|US',
    createdAt: '2026-08-04',
  },
  {
    id: 'insp-aspen-note',
    kind: 'note',
    title: 'Landing plan',
    subtitle: 'KASE fills over the holiday fortnight',
    sourceLabel: 'Trip note',
    imageLabel: 'Note',
    savedBy: EDITORIAL_SAVERS.nico,
    votes: { mustDo: 2, maybe: 1, skip: 0 },
    category: 'Access',
    destinationId: 'aspen|US',
    createdAt: '2026-08-25',
    note: 'Crews reposition to Rifle or Eagle overnight. Confirm the slot with the operator — MERIDIAN does not hold inventory.',
  },
];

const monaco: InspirationItem[] = [
  {
    id: 'insp-monaco-harbor',
    kind: 'place',
    title: 'Port Hercules dawn',
    subtitle: 'Before the circuit closes',
    sourceLabel: 'Editorial note',
    imageLabel: 'Harbor',
    savedBy: EDITORIAL_SAVERS.nico,
    votes: { mustDo: 3, maybe: 1, skip: 0 },
    category: 'Place',
    destinationId: 'monte-carlo|MC',
    createdAt: '2026-07-02',
  },
  {
    id: 'insp-monaco-table',
    kind: 'restaurant',
    title: 'A table with a harbor line',
    subtitle: 'Request only — no implied hold',
    sourceLabel: 'Editorial note',
    imageLabel: 'Dining',
    savedBy: EDITORIAL_SAVERS.jules,
    votes: { mustDo: 2, maybe: 2, skip: 0 },
    category: 'Dining',
    destinationId: 'monte-carlo|MC',
    createdAt: '2026-07-08',
  },
];

const FIXTURES: InspirationItem[] = [...aspen, ...monaco];

export const INSPIRATION_FIXTURE_DISCLOSURE =
  'Sample inspiration board — editorial fixtures for product preview. Not live saves from members.';

export function listInspiration(destinationId: string): InspirationItem[] {
  return FIXTURES.filter((item) => item.destinationId === destinationId);
}

export function listAllInspiration(): InspirationItem[] {
  return FIXTURES;
}
