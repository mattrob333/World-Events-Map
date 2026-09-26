import { NextResponse } from 'next/server';
import { originAllowed } from '@/lib/designer/server/guard';
import { placeVariants } from '@/lib/now/placeVariants';
import { consumeNowClientRateLimit } from '@/lib/now/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DAY_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; hit: { lat: number; lng: number; label: string } | null }>();
// One Nominatim request at a time, at least 1.1 s apart, however many arrive together.
let queue: Promise<void> = Promise.resolve();
function nextSlot(): Promise<void> {
  const slot = queue.then(() => new Promise<void>((resolve) => setTimeout(resolve, 1100)));
  const turn = queue;
  queue = slot;
  return turn;
}

/** From our own pages only: a same-origin fetch, or failing that header, our own Referer. */
function fromOurSite(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin';
  const referer = request.headers.get('referer');
  try {
    return referer ? originAllowed(new URL(referer).origin) : false;
  } catch {
    return false;
  }
}

/**
 * A place they named ("Flushing, Queens") to a point, for Vibe Now. Uses
 * OpenStreetMap's Nominatim: cached a day per query and never faster than one
 * request a second, as its usage policy asks. Only the words they said are
 * sent; nothing about them.
 */
export async function GET(request: Request) {
  if (!fromOurSite(request)) return NextResponse.json({ error: 'Same-origin only.' }, { status: 403 });
  const q = new URL(request.url).searchParams.get('q')?.replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, 80) ?? '';
  if (q.length < 2) return NextResponse.json({ error: 'Say a place.' }, { status: 400 });
  const key = q.toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < DAY_MS) return NextResponse.json({ place: cached.hit });
  const limit = consumeNowClientRateLimit(request);
  if (!limit.allowed) return NextResponse.json({ error: 'Too many lookups. Try again in a few minutes.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } });
  try {
    let hit: { lat: number; lng: number; label: string } | null = null;
    for (const variant of placeVariants(q)) {
      await nextSlot();
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=0&q=${encodeURIComponent(variant)}`;
      const response = await fetch(url, { headers: { 'User-Agent': 'dope.travel/1.0 (+https://dope.travel)', Accept: 'application/json' }, signal: AbortSignal.timeout(6000), cache: 'no-store' });
      if (!response.ok) return NextResponse.json({ error: 'That place could not be looked up.' }, { status: 502 });
      const rows = (await response.json()) as { lat?: string; lon?: string; display_name?: string }[];
      const row = rows[0];
      const lat = Number(row?.lat);
      const lng = Number(row?.lon);
      if (row && Number.isFinite(lat) && Number.isFinite(lng)) {
        hit = { lat, lng, label: String(row.display_name ?? variant).split(',').slice(0, 3).join(',').trim() };
        break;
      }
    }
    if (cache.size > 500) cache.delete(cache.keys().next().value as string);
    cache.set(key, { at: Date.now(), hit });
    return NextResponse.json({ place: hit });
  } catch {
    return NextResponse.json({ error: 'That place could not be looked up.' }, { status: 502 });
  }
}
