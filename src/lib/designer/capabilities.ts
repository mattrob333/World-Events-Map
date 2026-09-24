import 'server-only';
import type { EventSource } from './concerts';

/**
 * What this deployment can actually do, read from server env at call time.
 * Every string that promises live data (events, playlist reading, Spotify
 * sign-in) should be driven by these flags so copy never outruns config.
 * Only booleans leave the server; never the keys themselves.
 */
export type Capabilities = {
  /** A public playlist link can be read with the app's own credentials. */
  spotifyPlaylist: boolean;
  /** The browser can start Spotify sign-in (a public client id is set). */
  spotifySignIn: boolean;
  /** Ticketmaster and/or SeatGeek listings are available. */
  events: boolean;
  eventSources: EventSource[];
};

type Env = Record<string, string | undefined>;

export function eventKeys(env: Env = process.env) {
  const keys = { ticketmaster: env.TICKETMASTER_API_KEY || undefined, seatgeek: env.SEATGEEK_CLIENT_ID || undefined };
  return { keys, sources: (Object.keys(keys) as EventSource[]).filter((key) => keys[key]) };
}

export function serverCapabilities(env: Env = process.env): Capabilities {
  const spotifyId = env.SPOTIFY_CLIENT_ID || env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
  const { sources } = eventKeys(env);
  return {
    spotifyPlaylist: Boolean(spotifyId && env.SPOTIFY_CLIENT_SECRET),
    spotifySignIn: Boolean(env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID),
    events: sources.length > 0,
    eventSources: sources,
  };
}

const SOURCE_LABEL: Record<EventSource, string> = { ticketmaster: 'Ticketmaster', seatgeek: 'SeatGeek' };

export function eventSourceLabel(sources: EventSource[]): string {
  return sources.map((source) => SOURCE_LABEL[source]).join(' and ');
}

/**
 * The public origin for links and the MCP address. Uses configured site URLs
 * only, never the request's Host header (which a client controls).
 */
export function siteOrigin(env: Env = process.env): string {
  const configured = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured && /^https?:\/\/[^\s/]+/i.test(configured)) return configured.replace(/\/+$/, '');
  // On a preview, links should open that preview, not production (retest N7).
  const vercel = (env.VERCEL_ENV === 'preview' ? env.VERCEL_BRANCH_URL || env.VERCEL_URL : env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL)?.trim();
  if (vercel && /^[a-z0-9.-]+(?::\d+)?$/i.test(vercel)) return `https://${vercel}`;
  if (env.NODE_ENV !== 'production') return `http://localhost:${env.PORT || 3000}`;
  return 'https://dope.travel';
}
