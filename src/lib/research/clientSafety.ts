import type { DestinationResearch, ResearchEvent, ResearchPost, ResearchSection, ResearchSpot } from './destinationSources';

type PlaceResearch = Omit<DestinationResearch, 'flights'>;

const SPOT_HOSTS = ['google.com', 'tripadvisor.com', 'yelp.com'];
const POST_HOSTS = ['instagram.com', 'tiktok.com'];
const IMAGE_HOSTS = ['googleusercontent.com', 'ggpht.com', 'gstatic.com', 'tripadvisor.com', 'yelpcdn.com', 'cdninstagram.com', 'fbcdn.net', 'tiktokcdn.com', 'tiktokcdn-us.com', 'tiktokcdn-eu.com'];

/** An https link, optionally only on `hosts` (or their subdomains). Anything else is dropped. */
export function safeHref(value: unknown, hosts?: string[]): string | undefined {
  if (typeof value !== 'string' || value.length > 2000) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return undefined;
    const host = url.hostname.toLowerCase();
    if (hosts && !hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

/** Invisible and direction-flipping characters out, so a name reads as it is. */
export function plainText(value: string): string {
  return value.replace(/[\p{Cc}\p{Cf}]/gu, '').replace(/\s+/g, ' ').trim();
}

function section<T extends { url: string; image?: { url: string; alt: string } }>(block: ResearchSection<T> | undefined, hosts: string[] | undefined, clean: (item: T) => T): ResearchSection<T> | undefined {
  if (!block || !Array.isArray(block.items)) return block;
  const items = block.items.flatMap((item) => {
    const url = safeHref(item.url, hosts);
    if (!url) return [];
    const image = item.image && safeHref(item.image.url, IMAGE_HOSTS) ? item.image : undefined;
    return [clean({ ...item, url, image })];
  });
  return { ...block, items };
}

/**
 * The server already keeps only provider links; this re-checks on the device,
 * so a stale cache entry or a tampered response can't put a data:, javascript:
 * or off-provider link, or reversed text, on the page.
 */
export function safeResearch<R extends PlaceResearch>(research: R): R {
  const spot = (item: ResearchSpot): ResearchSpot => ({ ...item, name: plainText(item.name) || 'Unnamed place', category: item.category ? plainText(item.category) : undefined });
  const post = (item: ResearchPost): ResearchPost => ({ ...item, author: plainText(item.author), caption: plainText(item.caption) });
  const event = (item: ResearchEvent): ResearchEvent => ({ ...item, title: plainText(item.title), venue: item.venue ? plainText(item.venue) : undefined });
  return {
    ...research,
    topSpots: section(research.topSpots, SPOT_HOSTS, spot)!,
    food: section(research.food, SPOT_HOSTS, spot)!,
    nightlife: section(research.nightlife, SPOT_HOSTS, spot)!,
    hiddenGems: section(research.hiddenGems, SPOT_HOSTS, spot)!,
    tripadvisor: section(research.tripadvisor, SPOT_HOSTS, spot)!,
    yelp: section(research.yelp, SPOT_HOSTS, spot)!,
    instagram: section(research.instagram, POST_HOSTS, post)!,
    tiktok: section(research.tiktok, POST_HOSTS, post)!,
    events: section(research.events, undefined, event)!,
  };
}
