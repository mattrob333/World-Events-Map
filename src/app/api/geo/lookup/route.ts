import { NextResponse } from 'next/server';
import { originAllowed } from '@/lib/designer/server/guard';
import { placeVariants } from '@/lib/now/placeVariants';
import { consumeNowClientRateLimit } from '@/lib/now/rateLimit';
import { requireMember } from '@/lib/platform/server/member';

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
  // Members only: this route spends money or runs a search.
  const member = await requireMember(request);
  if (member instanceof Response) return member;
  if (!fromOurSite(request)) return NextResponse.json({ error: 'Same-origin only.' }, { status: 403 });
  const params = new URL(request.url).searchParams;
  // Where am I: a point (rounded to about a kilometer by the phone) to its town and region.
  if (params.has('lat') && params.has('lng')) return reverse(request, Number(params.get('lat')), Number(params.get('lng')));
  const q = params.get('q')?.replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, 80) ?? '';
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

const reverseCache = new Map<string, { at: number; label: string | null }>();

async function reverse(request: Request, rawLat: number, rawLng: number): Promise<Response> {
  if (!Number.isFinite(rawLat) || !Number.isFinite(rawLng) || Math.abs(rawLat) > 90 || Math.abs(rawLng) > 180) {
    return NextResponse.json({ error: 'That point isn’t on the map.' }, { status: 400 });
  }
  const lat = Math.round(rawLat * 100) / 100;
  const lng = Math.round(rawLng * 100) / 100;
  const key = `${lat},${lng}`;
  const cached = reverseCache.get(key);
  if (cached && Date.now() - cached.at < DAY_MS) return NextResponse.json({ label: cached.label });
  const limit = consumeNowClientRateLimit(request);
  if (!limit.allowed) return NextResponse.json({ error: 'Too many lookups. Try again in a few minutes.' }, { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } });
  try {
    await nextSlot();
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&addressdetails=1&lat=${lat}&lon=${lng}`;
    const response = await fetch(url, { headers: { 'User-Agent': 'dope.travel/1.0 (+https://dope.travel)', Accept: 'application/json' }, signal: AbortSignal.timeout(6000), cache: 'no-store' });
    if (!response.ok) return NextResponse.json({ error: 'That place could not be looked up.' }, { status: 502 });
    const body = (await response.json()) as { address?: Record<string, string> };
    const a = body.address ?? {};
    const town = a.city ?? a.town ?? a.village ?? a.suburb ?? a.county;
    const region = a.state ?? a.country;
    const label = town ? [town, region].filter(Boolean).join(', ').slice(0, 80) : null;
    if (reverseCache.size > 500) reverseCache.delete(reverseCache.keys().next().value as string);
    reverseCache.set(key, { at: Date.now(), label });
    return NextResponse.json({ label });
  } catch {
    return NextResponse.json({ error: 'That place could not be looked up.' }, { status: 502 });
  }
}
