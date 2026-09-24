import 'server-only';

import library from '../../../docs/research/source-library-2026-09-24.json';

/** A verified feed from the source library (docs/research). */
export type LibrarySource = {
  name: string;
  feedUrl: string;
  siteUrl: string;
  tier: 'A' | 'B' | 'C';
  kind: string;
  tripTypes: string[];
  regions: string[];
  /** Forums and communities: a signal of buzz, never shown as items. */
  signalOnly: boolean;
};

type RawSource = {
  name?: unknown; feed_url?: unknown; site_url?: unknown; tier?: unknown; kind?: unknown;
  beats?: unknown; trip_types?: unknown; region?: unknown; regions?: unknown; signal_only?: unknown;
};

// The first library tagged beats only; map them to trip types until every source carries its own.
const BEAT_TRIP_TYPES: Record<string, string[]> = {
  hot: ['city'], 'adults-only': ['nightlife'], hacks: ['points', 'deals'], gear: ['outdoors'], wild: ['adventure', 'outdoors'],
  'new sports': ['sports'], 'new-sports': ['sports'], psychedelic: ['wellness'], medical: ['wellness'],
  ski: ['ski'], surf: ['surf'], food: ['food'], nightlife: ['nightlife'], festivals: ['festivals'], music: ['music'],
  luxury: ['luxury'], family: ['family'], adventure: ['adventure'], culture: ['culture'], deals: ['deals'], city: ['city'], openings: ['city', 'food'],
};

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []);

export function normalizeSource(raw: RawSource): LibrarySource | null {
  if (typeof raw.name !== 'string' || typeof raw.feed_url !== 'string' || !/^https?:\/\//.test(raw.feed_url)) return null;
  const tier = raw.tier === 'A' || raw.tier === 'B' || raw.tier === 'C' ? raw.tier : 'C';
  const tripTypes = strings(raw.trip_types).length ? strings(raw.trip_types) : [...new Set(strings(raw.beats).flatMap((beat) => BEAT_TRIP_TYPES[beat] ?? []))];
  const regions = strings(raw.regions).length ? strings(raw.regions) : typeof raw.region === 'string' ? [raw.region] : ['global'];
  return {
    name: raw.name.slice(0, 120),
    feedUrl: raw.feed_url,
    siteUrl: typeof raw.site_url === 'string' ? raw.site_url : raw.feed_url,
    tier,
    kind: typeof raw.kind === 'string' ? raw.kind : 'magazine',
    tripTypes,
    regions,
    signalOnly: raw.signal_only === true,
  };
}

export function librarySources(): LibrarySource[] {
  const raw = (library as { sources?: RawSource[] }).sources ?? [];
  return raw.map(normalizeSource).filter((source): source is LibrarySource => source !== null);
}
