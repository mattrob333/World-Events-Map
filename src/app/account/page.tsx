import { Account } from '@/components/community/Account';

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const query = await searchParams;
  return <Account initialEvent={typeof query.event === 'string' ? query.event : ''} />;
}
