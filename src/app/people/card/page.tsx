import type { Metadata } from 'next';
import { CardReceive } from '@/components/people/CardReceive';

// The card is in the link fragment, so the page itself says nothing about who sent it.
export const metadata: Metadata = { title: 'A travel card · dope.travel', robots: { index: false } };

export default function TravelCardPage() {
  return <CardReceive />;
}
