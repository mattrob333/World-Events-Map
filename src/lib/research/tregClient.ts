import 'server-only';

/**
 * One paid call through Treg's /call/ relay. Every call carries a hard cost
 * ceiling (Treg refuses with 402 before billing when the reserve would exceed
 * it), and the receipt is recorded before the body is parsed so a billed call
 * with a malformed body still leaves a trace for reconciliation.
 */

export interface TregCallReceipt {
  endpoint: string;
  callId: string | null;
  costMicro: number | null;
}

export interface TregCallOptions {
  endpoint: string;
  method: 'GET' | 'POST';
  query?: Record<string, string>;
  body?: unknown;
  /** Hard per-call ceiling in USD, sent as X-Treg-Route-Max-Cost. */
  maxCostUsd: number;
  /** Accept Treg's archived answer when it is younger than this (seconds). */
  maxAgeSeconds?: number;
  idempotencyKey?: string;
  token: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxBytes?: number;
  /** Fallback fetch time when Treg sends none (tests pin this). */
  now?: Date;
  onReceipt?: (receipt: TregCallReceipt) => void;
}

export interface TregCallResult {
  status: number;
  ok: boolean;
  json: unknown;
  receipt: TregCallReceipt;
  /** When Treg says the answer was fetched from the provider, else now. */
  fetchedAt: string;
}

export class TregError extends Error {
  constructor(message: string, readonly status: number | null = null) {
    super(message);
  }
}

const ENDPOINT = /^[a-z0-9][a-z0-9._-]{2,120}$/;

export async function tregCall(options: TregCallOptions): Promise<TregCallResult> {
  if (!options.token) throw new TregError('Treg is not configured');
  if (!ENDPOINT.test(options.endpoint)) throw new TregError('Invalid Treg endpoint');
  if (!(options.maxCostUsd > 0 && options.maxCostUsd <= 0.05)) throw new TregError('Treg cost ceiling out of range');
  const url = new URL(`https://treg.to/call/${options.endpoint}`);
  for (const [key, value] of Object.entries(options.query ?? {})) url.searchParams.set(key, value);
  const headers: Record<string, string> = {
    'X-Treg-Token': options.token,
    'X-Treg-Route-Max-Cost': String(options.maxCostUsd),
    Accept: 'application/json',
  };
  if (options.maxAgeSeconds) headers['X-Treg-Max-Age'] = String(Math.round(options.maxAgeSeconds));
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await (options.fetchImpl ?? fetch)(
    options.query ? url.toString() : `https://treg.to/call/${options.endpoint}`,
    {
      method: options.method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: 'no-store',
      signal: AbortSignal.timeout(options.timeoutMs ?? 12_000),
    },
  );
  const costRaw = response.headers.get('x-treg-cost-micro');
  const receipt: TregCallReceipt = {
    endpoint: options.endpoint,
    callId: response.headers.get('x-treg-call-id'),
    costMicro: costRaw && /^\d+$/.test(costRaw) ? Number(costRaw) : null,
  };
  options.onReceipt?.(receipt);
  const rawText = await response.text();
  if (rawText.length > (options.maxBytes ?? 1_000_000)) throw new TregError('Treg response exceeded size limit', response.status);
  let json: unknown = null;
  if (rawText) {
    try {
      json = JSON.parse(rawText);
    } catch {
      if (response.ok) throw new TregError('Treg returned invalid JSON', response.status);
    }
  }
  const fetchedHeader = response.headers.get('x-treg-fetched-at');
  const fetchedMillis = fetchedHeader ? Date.parse(fetchedHeader) : NaN;
  const fetchedAt = Number.isFinite(fetchedMillis) && fetchedMillis <= Date.now() + 60_000
    ? new Date(fetchedMillis).toISOString()
    : (options.now ?? new Date()).toISOString();
  return { status: response.status, ok: response.ok, json, receipt, fetchedAt };
}
