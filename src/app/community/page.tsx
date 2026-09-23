import { Community } from '@/components/community/Community';

export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ event?: string; tab?: string; circle?: string }> }) {
  const query = await searchParams;
  return <Community initialEvent={typeof query.event === 'string' ? query.event : ''} initialCircle={typeof query.circle === 'string' ? query.circle : ''} initialTab={query.tab === 'offers' ? 'offers' : 'circles'} />;
}
