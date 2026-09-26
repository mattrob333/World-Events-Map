import type { Metadata } from 'next';
import { GroupReceive } from '@/components/you/GroupReceive';

// The group is in the link fragment, so the page itself says nothing about who sent it.
export const metadata: Metadata = { title: 'Travel together · dope.travel', robots: { index: false } };

export default function GroupInvitePage() {
  return <GroupReceive />;
}
