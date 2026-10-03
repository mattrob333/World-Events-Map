import type { Metadata } from 'next';
import { ReplyView } from '@/components/ski/ReplyView';

export const metadata: Metadata = {
  title: 'Ski trip votes · dope.travel',
  description: 'Votes on a ski trip. Tap to count them.',
  robots: { index: false },
};

export default function SkiReplyPage() {
  return <ReplyView />;
}
