import type { Metadata } from 'next';
import { NearbyPulse } from '@/components/now/NearbyPulse';
import { NowExperience } from '@/components/now/NowExperience';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Now · dope.travel',
  description: 'What’s busy near you right now, and when each place closes.',
};

/**
 * Now: the Vibe Now map where you are. A named city (`/now?city=Lisbon`, from
 * a city page) opens that city's scene instead, until Now can map any city.
 */
export default async function NowPage({ searchParams }: { searchParams: Promise<{ city?: string }> }) {
  const { city } = await searchParams;
  const initialCity = typeof city === 'string' ? city.trim().slice(0, 60) || undefined : undefined;
  if (!initialCity) return <NearbyPulse />;
  const providerConfigured = Boolean(
    process.env.BESTTIME_API_KEY_PRIVATE &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  return <NowExperience providerConfigured={providerConfigured} initialCity={initialCity} />;
}
