import 'server-only';

/**
 * Server-side JSON fetch for the live-conditions fetchers.
 *
 * - Open-Meteo: with `OPEN_METEO_API_KEY` set, requests go to the commercial
 *   customer hosts with `apikey`; without it, to the free keyless hosts (licensed
 *   for non-commercial use only). The key is added at the last moment and never
 *   appears in dedupe keys, errors, logs or payloads.
 * - Every request has a 6 s timeout and skips the Next data cache (the route's
 *   edge cache is the cache; a stored URL would carry the key).
 * - Identical concurrent requests share one upstream call. Entries leave the map
 *   as soon as the call settles, so it holds only what is in flight.
 */

export const TIMEOUT_MS = 6000;

const FREE = {
  forecast: 'https://api.open-meteo.com/v1/forecast',
  marine: 'https://marine-api.open-meteo.com/v1/marine',
} as const;

const COMMERCIAL = {
  forecast: 'https://customer-api.open-meteo.com/v1/forecast',
  marine: 'https://customer-marine-api.open-meteo.com/v1/marine',
} as const;

const COMMERCIAL_HOSTS = new Set(Object.values(COMMERCIAL).map((u) => new URL(u).host));

export const NOAA_KP_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json';

export const OPEN_METEO = { name: 'Open-Meteo', url: 'https://open-meteo.com/' };
export const OPEN_METEO_MARINE = { name: 'Open-Meteo Marine', url: 'https://open-meteo.com/en/docs/marine-weather-api' };
export const NOAA_SWPC = { name: 'NOAA SWPC', url: 'https://www.swpc.noaa.gov/products/planetary-k-index' };

function apiKey(): string | undefined {
  const key = process.env.OPEN_METEO_API_KEY?.trim();
  return key ? key : undefined;
}

/** Open-Meteo URL without any key. The host depends on whether a commercial key is configured. */
export function openMeteoUrl(api: 'forecast' | 'marine', params: Record<string, string | number | undefined>): string {
  const url = new URL(apiKey() ? COMMERCIAL[api] : FREE[api]);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  return url.toString();
}

/** Open-Meteo unit parameters. Metric is the API default. */
export function unitParams(units: 'imperial' | 'metric'): Record<string, string> {
  return units === 'imperial'
    ? { temperature_unit: 'fahrenheit', precipitation_unit: 'inch', wind_speed_unit: 'mph' }
    : {};
}

/** A failed upstream call. The message names only the host and the reason, never the URL or key. */
export class UpstreamError extends Error {
  constructor(readonly host: string, readonly reason: string) {
    super(`${host}: ${reason}`);
    this.name = 'UpstreamError';
  }
}

const inflight = new Map<string, Promise<unknown>>();

export function getJSON<T>(url: string): Promise<T> {
  const hit = inflight.get(url);
  if (hit) return hit as Promise<T>;
  const p = request<T>(url).finally(() => inflight.delete(url));
  inflight.set(url, p);
  return p;
}

/** Test hook: how many upstream calls are in flight. */
export const inflightCount = () => inflight.size;

async function request<T>(publicUrl: string): Promise<T> {
  const target = new URL(publicUrl);
  const host = target.host;
  const key = apiKey();
  if (key && COMMERCIAL_HOSTS.has(host)) target.searchParams.set('apikey', key);
  let res: Response;
  try {
    res = await fetch(target, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    throw new UpstreamError(host, timedOut ? 'timeout' : 'network');
  }
  if (!res.ok) throw new UpstreamError(host, `HTTP ${res.status}`);
  try {
    return (await res.json()) as T;
  } catch {
    throw new UpstreamError(host, 'bad JSON');
  }
}

/** Finite number or null. */
export const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export const round = (v: number, d = 0) => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};
