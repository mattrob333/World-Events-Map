import 'server-only';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { ogImageFrom } from '../ogImage';

const DAY_MS = 86_400_000;
const MAX_CACHED = 800;
const MAX_BYTES = 200_000;
const cache = new Map<string, { image: string | null; at: number }>();

const MAX_HOPS = 3;

/** Private, loopback, link-local and other non-public addresses. */
export function privateAddress(address: string): boolean {
  const v4 = /^(?:::ffff:)?(\d+)\.(\d+)\.(\d+)\.(\d+)$/i.exec(address);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  const v6 = address.toLowerCase();
  return v6 === '::' || v6 === '::1' || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || /^ff/.test(v6);
}

/** Only public https hosts, checked on every hop: a feed link can't bounce us into a private network. */
async function publicHttps(raw: string): Promise<URL | null> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (url.protocol !== 'https:' || (url.port && url.port !== '443') || isIP(host) || host === 'localhost' || /\.(?:local|internal|localhost)$/i.test(host)) return null;
  const addresses = await lookup(host, { all: true }).catch(() => []);
  if (!addresses.length || addresses.some((entry) => privateAddress(entry.address))) return null;
  return url;
}

/** Reads only the top of the page, where the meta tags live. */
async function headOf(start: string): Promise<{ html: string; url: string } | null> {
  let next = start;
  let response: Response | null = null;
  for (let hop = 0; hop <= MAX_HOPS; hop += 1) {
    const url = await publicHttps(next);
    if (!url) return null;
    response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; dope.travel link preview; +https://dope.travel)', Accept: 'text/html' },
      signal: AbortSignal.timeout(4000),
      redirect: 'manual',
      cache: 'no-store',
    });
    const location = response.status >= 300 && response.status < 400 ? response.headers.get('location') : null;
    if (!location) break;
    await response.body?.cancel().catch(() => undefined);
    next = new URL(location, url).toString();
    response = null;
  }
  if (!response || !response.ok || !response.body || !/html/i.test(response.headers.get('content-type') ?? '')) return null;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let html = '';
  while (html.length < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    html += decoder.decode(value, { stream: true });
    if (/<\/head>/i.test(html)) break;
  }
  await reader.cancel().catch(() => undefined);
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
