import { NowExperience } from '@/components/now/NowExperience';

export const dynamic = 'force-dynamic';

export default function NowPage() {
  const providerConfigured = Boolean(
    process.env.BESTTIME_API_KEY_PRIVATE &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  return <NowExperience providerConfigured={providerConfigured} />;
}
