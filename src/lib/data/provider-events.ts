import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { AIRPORTS } from './events';
import {
  EVENT_CATEGORIES,
  type WorldEvent,
  type EventCategory,
} from '@/lib/types';
import type { EventSubmissionRecord } from '@/lib/platform/types';

export function providerEvent(record: EventSubmissionRecord): WorldEvent {
  const rad = Math.PI / 180;
  const distance = (lat: number, lon: number) =>
    Math.sin(((lat - record.latitude) * rad) / 2) ** 2 +
    Math.cos(record.latitude * rad) *
      Math.cos(lat * rad) *
      Math.sin(((lon - record.longitude) * rad) / 2) ** 2;
  const nearest = AIRPORTS.reduce((a, b) =>
    distance(a.coords.lat, a.coords.lon) < distance(b.coords.lat, b.coords.lon)
      ? a
      : b,
  );
  return {
    id: `partner-${record.id}`,
    providerId: record.provider_id,
    name: record.name,
    tagline: record.description.slice(0, 90),
    description: record.description,
    category: EVENT_CATEGORIES.includes(record.category as EventCategory)
      ? (record.category as EventCategory)
      : 'cultural',
    city: record.destination,
    country: record.country,
    countryCode: record.country_code,
    coords: { lat: record.latitude, lon: record.longitude },
    timezone: record.timezone,
    start: record.start_date,
    end: record.end_date,
    recurrence: 'one-off',
    tier: 'insider',
    priceIndex: 1,
    estimatedSpend: { min: 0, max: 0, currency: 'USD' },
    accessNote:
      'Published by an approved partner. Contact the host to confirm access, price and exact arrival details.',
    venues: [record.venue],
    nearestJetPort: nearest,
    whyGo: ['An independently submitted experience from an approved partner'],
    tags: ['Partner event'],
    signals: {
      socialMentions: 0,
      socialVelocity: 0,
      searchInterest: 0,
      mediaMentions: 0,
      bookingPressure: 0,
      exclusivity: 0,
    },
  };
}

/** Anonymous RLS read ensures neither pending submissions nor suspended providers leak. */
export async function getProviderEvents(): Promise<WorldEvent[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db
    .from('event_submissions')
    .select('*')
    .eq('status', 'approved')
    .order('start_date')
    .limit(1000);
  if (error) throw new Error('Partner calendar unavailable');
  return (data ?? []).map(providerEvent);
}
