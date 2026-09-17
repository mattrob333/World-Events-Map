import { Community } from '@/components/community/Community';

export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ event?: string; tab?: string }> }) {
  const query = await searchParams;
  return <Community initialEvent={typeof query.event === 'string' ? query.event : ''} initialTab={query.tab === 'offers' ? 'offers' : 'circles'} />;
}
