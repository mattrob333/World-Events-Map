import type { SupabaseClient } from '@supabase/supabase-js';
import type { PartnerOffer } from './types';

/** A published offer as travelers see it, with the approved provider's name. */
export type PublishedOffer = Pick<
  PartnerOffer,
  | 'id'
  | 'title'
  | 'description'
  | 'destination'
  | 'event_id'
  | 'kind'
  | 'price_label'
  | 'availability'
  | 'expires_at'
  | 'created_at'
> & { provider_name: string };

export const PARTNER_OFFER_KIND_LABEL: Record<PartnerOffer['kind'], string> = {
  stay: 'Stay',
  arrive: 'Arrival',
  access: 'Access & tables',
  curated: 'Curated experience',
};

/** Shown under every partner price: a provider label is never a quote. */
export const OFFER_PRICE_QUALIFIER = 'Indicative. The provider confirms price and availability when they reply.';

export function offerAvailabilityLabel(offer: { availability: string }): string {
  return offer.availability === 'provider_updated'
    ? 'Provider-updated details · subject to confirmation'
    : 'Availability on request';
}

type OfferRow = Omit<PublishedOffer, 'provider_name'> & {
  provider_orgs: { name: string } | { name: string }[] | null;
};

export function toPublishedOffer(row: OfferRow): PublishedOffer {
  const org = Array.isArray(row.provider_orgs) ? row.provider_orgs[0] : row.provider_orgs;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    destination: row.destination,
    event_id: row.event_id,
    kind: row.kind,
    price_label: row.price_label,
    availability: row.availability,
    expires_at: row.expires_at,
    created_at: row.created_at,
    provider_name: org?.name ?? 'Verified partner',
  };
}

/**
 * The one read path for traveler-facing partner offers. RLS already limits
 * anonymous reads to published, unexpired offers from approved providers;
 * the filters here keep the query honest if a policy is widened later.
 */
export async function fetchPublishedOffers(
  client: SupabaseClient,
  options: { limit?: number } = {},
): Promise<{ offers: PublishedOffer[]; error: string | null }> {
  const { data, error } = await client
    .from('offers')
    .select(
      'id,title,description,destination,event_id,kind,price_label,availability,expires_at,created_at,provider_orgs!inner(name,status)',
    )
    .eq('provider_orgs.status', 'approved')
    .eq('status', 'published')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(options.limit ?? 100);
  if (error) return { offers: [], error: 'Partner offers could not be loaded.' };
  return { offers: ((data ?? []) as OfferRow[]).map(toPublishedOffer), error: null };
}
