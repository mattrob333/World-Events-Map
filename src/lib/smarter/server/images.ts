import 'server-only';
import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import type { IncomingMessage } from 'node:http';
import { get, type RequestOptions } from 'node:https';
import { BlockList, isIP, type LookupFunction } from 'node:net';
import { pipeline, type Readable } from 'node:stream';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';
import { ogImageFrom } from '../ogImage';

const DAY_MS = 86_400_000;
const MAX_CACHED = 800;
const MAX_BYTES = 200_000;
const cache = new Map<string, { image: string | null; at: number }>();

const MAX_HOPS = 3;

/** Every address a link preview must never reach. IPv4-mapped IPv6 (::ffff:a.b.c.d) is checked as its IPv4. */
const BLOCKED = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 3],
] as const) BLOCKED.addSubnet(network, prefix, 'ipv4');
for (const [network, prefix] of [
  // Unspecified, loopback and IPv4-compatible (::a.b.c.d).
  ['::', 128], ['::1', 128], ['::', 96],
  // NAT64: any IPv4 address, private ones included, wrapped in IPv6.
  ['64:ff9b::', 96], ['64:ff9b:1::', 48],
  ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8],
] as const) BLOCKED.addSubnet(network, prefix, 'ipv6');

/** Private, loopback, link-local and other non-public addresses. Anything that isn't an IP address counts too. */
export function privateAddress(address: string): boolean {
  const family = isIP(address);
  if (!family) return true;
  return BLOCKED.check(address, family === 6 ? 'ipv6' : 'ipv4');
}

/**
 * DNS for the connection itself: the address checked is the address dialled,
 * so a name can't pass a check and then resolve somewhere private when the
 * socket opens (DNS rebinding). Any private answer refuses the whole name.
 */
export const publicLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { family: options.family, hints: options.hints, all: true }, (error, found: LookupAddress[]) => {
    if (error) return callback(error, '', 0);
    if (!found.length || found.some((entry) => privateAddress(entry.address))) {
      return callback(Object.assign(new Error(`Refused a non-public address for ${hostname}`), { code: 'EPRIVATE' }), '', 0);
    }
    // Node asks for every address when it races IPv4 and IPv6 (autoSelectFamily).
    if (options.all) return (callback as unknown as (error: null, addresses: LookupAddress[]) => void)(null, found);
    callback(null, found[0].address, found[0].family);
  });
};

/** Only public https hosts, checked on every hop: a feed link can't bounce us into a private network. */
function publicHttps(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (url.protocol !== 'https:' || (url.port && url.port !== '443') || isIP(host) || host === 'localhost' || /\.(?:local|internal|localhost)$/i.test(host)) return null;
  return url;
}

/** One GET whose socket can only open to a public address (publicLookup runs at connect time). */
function request(url: URL, signal: AbortSignal): Promise<IncomingMessage> {
  const options: RequestOptions = {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; dope.travel link preview; +https://dope.travel)', Accept: 'text/html', 'Accept-Encoding': 'gzip, deflate, br' },
    lookup: publicLookup,
    signal,
  };
  return new Promise((resolve, reject) => {
    get(url, options, resolve).on('error', reject);
  });
}

/** The body as sent before compression; a failed or aborted response fails the stream too. */
function decoded(response: IncomingMessage): Readable {
  const encoding = String(response.headers['content-encoding'] ?? '').trim().toLowerCase();
  const unzip = encoding === 'gzip' || encoding === 'x-gzip' ? createGunzip() : encoding === 'deflate' ? createInflate() : encoding === 'br' ? createBrotliDecompress() : null;
  return unzip ? pipeline(response, unzip, () => undefined) : response;
}

/** Reads only the top of the page, where the meta tags live. */
async function headOf(start: string): Promise<{ html: string; url: string } | null> {
  const signal = AbortSignal.timeout(4000);
  let next = start;
  let response: IncomingMessage | null = null;
  for (let hop = 0; hop <= MAX_HOPS; hop += 1) {
    const url = publicHttps(next);
    if (!url) return null;
    response = await request(url, signal);
    const status = response.statusCode ?? 0;
    const location = status >= 300 && status < 400 ? response.headers.location : undefined;
    if (!location) break;
    response.destroy();
    next = new URL(location, url).toString();
    response = null;
  }
  if (!response) return null;
  const status = response.statusCode ?? 0;
  if (status < 200 || status >= 300 || !/html/i.test(String(response.headers['content-type'] ?? ''))) {
    response.destroy();
    return null;
  }
  const body = decoded(response);
  const decoder = new TextDecoder();
  let html = '';
  try {
    for await (const chunk of body) {
      html += decoder.decode(chunk as Uint8Array, { stream: true });
      if (html.length >= MAX_BYTES || /<\/head>/i.test(html)) break;
    }
  } finally {
    body.destroy();
    response.destroy();
  }
  return { html, url: next };
}

async function imageFor(url: string): Promise<string | null> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < DAY_MS) return hit.image;
  const image = await headOf(url).then((page) => (page ? ogImageFrom(page.html, page.url) : null)).catch(() => null);
  if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value!);
  cache.set(url, { image, at: Date.now() });
  return image;
}

/**
 * Each story's own preview image, as link previews show it: fetched from the
 * publisher's page, a few at a time, remembered for a day. A story whose page
 * has none, or is slow, simply has no image.
 */
export async function previewImages(urls: readonly string[], concurrency = 10): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, async () => {
    while (next < urls.length) {
      const url = urls[next++];
      out.set(url, await imageFor(url));
    }
  }));
  return out;
}
