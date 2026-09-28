import type { Activity } from '../activities';

/**
 * Types for the live-conditions payload. Type-only and safe to import from client
 * components: the fetchers themselves are server-only (see `./index.ts`), and the
 * card reads their output from GET /api/activity-conditions.
 */

export type Units = 'imperial' | 'metric';

export type ConditionsKindName = 'snow' | 'marine' | 'beach' | 'aurora' | 'event' | 'weather';

export interface Stat {
  label: string;
  value: string;
  unit?: string;
  /** Optional https link (event tickets or details). */
  href?: string;
}

export interface Conditions {
  kind: ConditionsKindName;
  /** At most 3. Never contains zero placeholders: missing or zero values are left out. */
  stats: Stat[];
  /** One-line note, e.g. "No snow in the next 7 days." */
  note?: string;
  /** One plain line that explains what the numbers mean, e.g. "3 ft at 11 s: fun for most surfers." */
  explain?: string;
  /** Short reason when conditions are good right now; feeds the verdict line. */
  good: string | null;
  /** "Modeled" for model output (Open-Meteo), "Forecast" for NOAA forecasts, "Listed" for event listings. */
  basis: 'Modeled' | 'Forecast' | 'Listed';
  sources: { name: string; url: string }[];
  /** ISO 8601 time the payload was built. */
  updatedAt: string;
}

export interface FetchContext {
  units: Units;
  now: Date;
  /**
   * Called when an optional upstream (one of several a fetcher combines) failed and
   * the fetcher carried on without it. The route uses it to keep a partial answer
   * on a short cache instead of pinning it for hours.
   */
  onUpstreamError?: () => void;
}

/**
 * A fetcher returns null when there is no usable data (the card then hides the
 * module) and throws when its upstream failed outright.
 */
export type Fetcher = (a: Activity, ctx: FetchContext) => Promise<Conditions | null>;
