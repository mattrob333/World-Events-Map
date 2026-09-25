/**
 * Booking partners: pre-filled hand-off links, with affiliate tracking when an
 * ID is configured. dope.travel never books, holds or prices anything here;
 * each link opens the partner's own search or page, where availability and
 * prices live. Affiliate IDs are public URL parameters, not secrets, so they
 * are read from NEXT_PUBLIC_* variables and inlined at build time.
 */

export type PartnerId = 'opentable' | 'booking' | 'airbnb' | 'vrbo';

export const PARTNER_LABEL: Record<PartnerId, string> = {
  opentable: 'OpenTable',
  booking: 'Booking.com',
  airbnb: 'Airbnb',
  vrbo: 'Vrbo',
};

export type AffiliateConfig = {
  /** Booking.com Affiliate Partner Programme ID, sent as `aid`. */
  bookingAid?: string;
  /** OpenTable partner/affiliate referral ID, sent as `ref`. */
  openTableRef?: string;
  /**
   * Vrbo pays through the Expedia Group affiliate program, whose link builder
   * issues its own tracking parameters. Paste them as a query string
   * ("key=value&key2=value2"); they are appended unchanged.
   */
  vrboQuery?: string;
};

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const QUERY = /^[A-Za-z0-9_.~-]+=[A-Za-z0-9_.~%-]*(?:&[A-Za-z0-9_.~-]+=[A-Za-z0-9_.~%-]*){0,7}$/;

/** Affiliate IDs from the build's public env. Malformed values are ignored, never sent. */
export function affiliateConfig(env: Record<string, string | undefined> = {
  NEXT_PUBLIC_BOOKING_AID: process.env.NEXT_PUBLIC_BOOKING_AID,
  NEXT_PUBLIC_OPENTABLE_REF: process.env.NEXT_PUBLIC_OPENTABLE_REF,
  NEXT_PUBLIC_VRBO_AFFILIATE_QUERY: process.env.NEXT_PUBLIC_VRBO_AFFILIATE_QUERY,
}): AffiliateConfig {
  const id = (value?: string) => (value && ID.test(value.trim()) ? value.trim() : undefined);
  const query = env.NEXT_PUBLIC_VRBO_AFFILIATE_QUERY?.trim();
  return {
    bookingAid: id(env.NEXT_PUBLIC_BOOKING_AID),
    openTableRef: id(env.NEXT_PUBLIC_OPENTABLE_REF),
    vrboQuery: query && QUERY.test(query) ? query : undefined,
  };
}

/** The disclosure shown next to partner links once any affiliate ID is live; null while none is. */
export function affiliateDisclosure(config: AffiliateConfig = affiliateConfig()): string | null {
  return config.bookingAid || config.openTableRef || config.vrboQuery ? 'dope.travel may earn a commission if you book through these links. It doesn’t change the price.' : null;
}

/** Adds the partner's tracking to a URL on that partner's own site. Other URLs pass through untouched. */
export function withAffiliate(partner: PartnerId, href: string, config: AffiliateConfig = affiliateConfig()): string {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return href;
  }
  const host = url.hostname.replace(/^www\./, '');
  if (partner === 'booking' && config.bookingAid && host.endsWith('booking.com')) url.searchParams.set('aid', config.bookingAid);
  if (partner === 'opentable' && config.openTableRef && host.endsWith('opentable.com')) url.searchParams.set('ref', config.openTableRef);
  if (partner === 'vrbo' && config.vrboQuery && host.endsWith('vrbo.com')) {
    for (const [key, value] of new URLSearchParams(config.vrboQuery)) url.searchParams.set(key, value);
  }
  // Airbnb closed its affiliate program; its links carry no tracking.
  return url.toString();
}

export type TableRequest = {
  /** Restaurant name as the listing gave it. */
  name: string;
  /** City or area, to keep the search on the right place. */
  where?: string;
  /** YYYY-MM-DD */
  date?: string;
  /** HH:MM, 24-hour */
  time?: string;
  covers: number;
};

const TERM_MAX = 120;

/** Name plus city, the name trimmed at a word boundary so the city always survives. */
function searchTerm(name: string, where?: string): string {
  const city = (where ?? '').trim().slice(0, 60);
  const room = TERM_MAX - (city ? city.length + 1 : 0);
  let trimmed = name.trim();
  if (trimmed.length > room) {
    const cut = trimmed.slice(0, room);
    const space = cut.lastIndexOf(' ');
    trimmed = (space > room / 2 ? cut.slice(0, space) : cut).trim();
  }
  return [trimmed, city].filter(Boolean).join(' ');
}

const NO_TABLES = /\b(bakery|bakeries|pastel|pastelaria|patisserie|food hall|market|mercado|caf[eé]|coffee|ice cream|gelato|takeaway|take-away|food truck)\b/i;

/** Places that don't take table bookings (bakeries, food halls, cafés) get no OpenTable hand-off. */
export function takesTableSearch(place: { name: string; category?: string }): boolean {
  return !NO_TABLES.test(`${place.name} ${place.category ?? ''}`);
}

/**
 * An OpenTable search for one restaurant with the date, time and party filled
 * in. It's a search, not a reservation: the restaurant may not be on
 * OpenTable, and times are confirmed on their site.
 */
export function openTableSearch(request: TableRequest, config: AffiliateConfig = affiliateConfig()): string {
  const params = new URLSearchParams();
  params.set('term', searchTerm(request.name, request.where));
  params.set('covers', String(Math.min(20, Math.max(1, Math.round(request.covers)))));
  if (request.date && /^\d{4}-\d{2}-\d{2}$/.test(request.date)) {
    const time = request.time && /^\d{2}:\d{2}$/.test(request.time) ? request.time : '19:30';
    params.set('dateTime', `${request.date}T${time}`);
  }
  return withAffiliate('opentable', `https://www.opentable.com/s?${params}`, config);
}

/** The honest line under any hand-off button. */
export function handoffNote(partner: PartnerId): string {
  return `Opens ${PARTNER_LABEL[partner]}. Availability and prices live there; dope.travel doesn’t book.`;
}
