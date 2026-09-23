import { notFound, redirect } from 'next/navigation';
import { DestinationPage } from '@/components/destination/DestinationPage';
import { todayISO } from '@/lib/buzz/dates';
import { EVENTS } from '@/lib/data/events';
import { getDestinationBySlug } from '@/lib/pulse';

function normalizeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw).trim().toLowerCase();
  } catch {
    return raw.trim().toLowerCase();
  }
}

export default async function DestinationRoute({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ event?: string }>;
}) {
  const [{ slug }, { event }] = await Promise.all([params, searchParams]);
  const normalized = normalizeSlug(slug);
  const eventId = typeof event === 'string' ? event.slice(0, 100) : '';
  if (normalized !== slug && getDestinationBySlug(EVENTS, normalized, todayISO())) {
    redirect(`/destinations/${normalized}${eventId ? `?event=${encodeURIComponent(eventId)}` : ''}`);
  }
  if (!getDestinationBySlug(EVENTS, normalized, todayISO())) notFound();
  return <DestinationPage slug={normalized} focusEventId={eventId} />;
}
