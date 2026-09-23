import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';

export default function DestinationNotFound() {
  return (
    <main className="px-4 py-16 sm:px-8">
      <EmptyState
        title="That destination is not on the calendar."
        body="MERIDIAN destinations are built from curated occasions. Search for a city that is actually on the board."
        action={
          <Link href="/" className="text-[12px] text-brass">
            Return to World
          </Link>
        }
      />
    </main>
  );
}
