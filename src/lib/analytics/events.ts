/**
 * Product analytics contract.
 *
 * No vendor is selected this sprint. The adapter logs in development and
 * no-ops in production. Do not attach emails, precise coordinates, or
 * message bodies.
 */

export const PRODUCT_EVENTS = [
  'world_opened',
  'destination_opened',
  'destination_saved',
  'destination_watched',
  'destination_id_go',
  'event_saved',
  'profile_opened',
  'connection_requested',
  'circle_started',
  'circle_join_requested',
  'circle_invite_sent',
  'inspiration_added',
  'inspiration_voted',
  'access_offer_opened',
  'access_inquiry_sent',
  'now_started',
  'maps_opened',
  'went',
  'skipped',
  'returned_to_destination',
  'search_opened',
  'onboarding_completed',
  'onboarding_skipped',
] as const;

export type ProductEventName = (typeof PRODUCT_EVENTS)[number];

export interface ProductEvent {
  name: ProductEventName;
  at: string;
  properties?: Record<string, string | number | boolean | null>;
}

export interface AnalyticsAdapter {
  track(event: ProductEvent): void;
}

const consoleAdapter: AnalyticsAdapter = {
  track(event) {
    if (process.env.NODE_ENV === 'development') {
      console.debug('[meridian:event]', event.name, event.properties ?? {});
    }
  },
};

let adapter: AnalyticsAdapter = consoleAdapter;

export function setAnalyticsAdapter(next: AnalyticsAdapter): void {
  adapter = next;
}

export function track(
  name: ProductEventName,
  properties?: ProductEvent['properties'],
): void {
  adapter.track({
    name,
    at: new Date().toISOString(),
    properties,
  });
}
