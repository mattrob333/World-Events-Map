import 'server-only';
import { ogImageFrom } from '../ogImage';

const DAY_MS = 86_400_000;
const MAX_CACHED = 800;
const MAX_BYTES = 200_000;
const cache = new Map<string, { image: string | null; at: number }>();

/** Reads only the top of the page, where the meta tags live. */
async function headOf(url: string): Promise<string | null> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; dope.travel link preview; +https://dope.travel)', Accept: 'text/html' },
    signal: AbortSignal.timeout(4000),
    redirect: 'follow',
    cache: 'no-store',
  });
  if (!response.ok || !response.body || !/html/i.test(response.headers.get('content-type') ?? '')) return null;
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
  return html;
}

async function imageFor(url: string): Promise<string | null> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < DAY_MS) return hit.image;
  const image = /^https:\/\//.test(url) ? await headOf(url).then((html) => (html ? ogImageFrom(html, url) : null)).catch(() => null) : null;
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
