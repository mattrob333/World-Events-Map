import type { Metadata } from 'next';
import { VoteView } from '@/components/ski/VoteView';

// Generic on purpose: a chat app's preview shows this, and the plan itself stays in the link's fragment.
export const metadata: Metadata = {
  title: 'Vote on a ski trip · dope.travel',
  description: 'Someone wants your vote on where to ski. Tap to vote.',
  robots: { index: false },
};

export default function SkiVotePage() {
  return <VoteView />;
}
