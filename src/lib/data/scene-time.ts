import type { WorldEvent } from '@/lib/types';
export function localDate(now: Date, timezone?: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
export function isHappeningToday(
  event: Pick<WorldEvent, 'start' | 'end' | 'timezone'>,
  now: Date,
): boolean {
  const today = localDate(now, event.timezone);
  return event.start <= today && event.end >= today;
}
