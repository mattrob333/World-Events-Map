import type { Mention } from './match';

export type LatestStory = {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  place: { key: string; name: string; country: string };
  /** A photo of the place from our editorial library, when there is one. */
  photo: { imageUrl: string; credit: string } | null;
  /** The place's page on dope.travel, when it has one. */
  href: string | null;
};

type PlaceInfo = { key: string; name: string; country: string; photo: LatestStory['photo']; href: string | null };

// Service notices, gear reviews and bureaucracy: news, but not a reason to go anywhere.
const NOISE = /\b(closures?|strikes?|delays?|disruptions?|permits?|visa rules|pr[ée]fecture|lawsuit|suitcase|luggage|backpack|review:|vs\.?|versus|credit cards?|points|miles|coupon|promo code|layoffs?|earnings|stock|shares|crash|killed|dies|death|arrested|police|fermetures|travaux|manifestations)\b/i;
// A handful of very common words in French, Spanish, German, Italian and Portuguese headlines.
const NOT_ENGLISH = /(?:^|\s)(?:le|la|les|des|du|une|et|à|ce|quelle|pour|que|el|los|las|del|und|der|die|das|il|della|di|do|da|em|com)(?=\s)/i;

export function isShowable(title: string): boolean {
  const words = title.trim().split(/\s+/);
  if (words.length < 4) return false;
  const foreign = (title.match(new RegExp(NOT_ENGLISH.source, 'gi')) ?? []).length;
  return !NOISE.test(title) && foreign < 2;
}

/**
 * The home page's live strip: fresh stories that name a place we cover.
 * Top-tier sources first, newest first, one story per source and per place,
 * and nothing older than `maxAgeDays`. Headlines link to the publisher.
 */
export function latestStories(
  byPlace: ReadonlyMap<string, readonly Mention[]>,
  places: ReadonlyMap<string, PlaceInfo>,
  now: Date,
  { limit = 6, maxAgeDays = 4 }: { limit?: number; maxAgeDays?: number } = {},
): LatestStory[] {
  const oldest = new Date(now.getTime() - maxAgeDays * 86_400_000).toISOString();
  const candidates: { mention: Mention; place: PlaceInfo }[] = [];
  for (const [key, mentions] of byPlace) {
    const place = places.get(key);
    if (!place) continue;
    for (const mention of mentions) {
      if (mention.tier === 'C' || mention.publishedAt < oldest || mention.publishedAt > now.toISOString()) continue;
      if (!isShowable(mention.title) || !/^https:\/\//.test(mention.url)) continue;
      candidates.push({ mention, place });
    }
  }
  // Pictured places first (the strip is visual), then source tier, then newest.
  candidates.sort((a, b) => Number(Boolean(b.place.photo)) - Number(Boolean(a.place.photo)) || a.mention.tier.localeCompare(b.mention.tier) || b.mention.publishedAt.localeCompare(a.mention.publishedAt));
  const sources = new Set<string>();
  const placesUsed = new Set<string>();
  const urls = new Set<string>();
  const out: LatestStory[] = [];
  for (const { mention, place } of candidates) {
    if (sources.has(mention.source) || placesUsed.has(place.key) || urls.has(mention.url)) continue;
    sources.add(mention.source);
    placesUsed.add(place.key);
    urls.add(mention.url);
    out.push({ title: mention.title, url: mention.url, source: mention.source, publishedAt: mention.publishedAt, place: { key: place.key, name: place.name, country: place.country }, photo: place.photo, href: place.href });
    if (out.length >= limit) break;
  }
  return out.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
