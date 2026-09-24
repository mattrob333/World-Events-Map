import { NowExperience } from '@/components/now/NowExperience';

export const dynamic = 'force-dynamic';

export default async function NowPage({ searchParams }: { searchParams: Promise<{ city?: string }> }) {
  const { city } = await searchParams;
  const initialCity = typeof city === 'string' ? city.trim().slice(0, 60) || undefined : undefined;
  const providerConfigured = Boolean(
    process.env.BESTTIME_API_KEY_PRIVATE &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  return <NowExperience providerConfigured={providerConfigured} initialCity={initialCity} />;
}
