export interface PartnerOffer {
  id: string;
  provider_id: string;
  event_id: string | null;
  destination: string;
  title: string;
  description: string;
  kind: 'stay' | 'arrive' | 'access' | 'curated';
  price_label: string;
  availability: 'request' | 'provider_updated';
  expires_at: string;
  status: 'draft' | 'published' | 'paused';
  created_at: string;
  updated_at: string;
}
export interface ProviderOrganization {
  id: string;
  owner_id: string;
  name: string;
  category: string;
  description: string;
  website: string;
  status: 'pending' | 'approved' | 'suspended';
}
/** dope.travel offers create inquiries, never bookings, holds or quotes. */
// Headline and price may not claim a booking, hold or guarantee. "Reserved
// table" is ordinary access copy, so "reserved" alone is allowed.
const BOOKING_CLAIM = /\b(confirmed|guaranteed?|booked|book (?:now|today)|instant booking|sold out)\b/i;
// Descriptions are longer prose ("confirmed on reply" is fine); only strong claims are refused there.
const DESCRIPTION_BOOKING_CLAIM = /\b(guaranteed?|book (?:now|today)|instant booking|booking confirmed)\b/i;

export function validateOffer(
  input: Pick<
    PartnerOffer,
    'title' | 'description' | 'destination' | 'expires_at' | 'price_label'
  >,
): string | null {
  if (input.title.trim().length < 3 || input.title.length > 140)
    return 'Use a title between 3 and 140 characters.';
  if (input.description.trim().length < 10 || input.description.length > 3000)
    return 'Describe the inclusions and terms in 10–3,000 characters.';
  if (input.destination.trim().length < 2 || input.destination.length > 120)
    return 'Add a destination between 2 and 120 characters.';
  if (input.price_label.length > 100)
    return 'Keep the price description under 100 characters.';
  if (BOOKING_CLAIM.test(`${input.title} ${input.price_label}`) || DESCRIPTION_BOOKING_CLAIM.test(input.description))
    return 'Offers are inquiries. Remove booking or confirmation wording such as "confirmed", "guaranteed" or "book now".';
  if (
    !Number.isFinite(Date.parse(input.expires_at)) ||
    Date.parse(input.expires_at) <= Date.now()
  )
    return 'Choose an expiry in the future.';
  return null;
}

/** An editorial submission, never inferred from curated event defaults. */
export interface EventSubmissionRecord {
  id: string;
  provider_id: string;
  name: string;
  description: string;
  destination: string;
  venue: string;
  country: string;
  country_code: string;
  timezone: string;
  category: string;
  start_date: string;
  end_date: string;
  latitude: number;
  longitude: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}
