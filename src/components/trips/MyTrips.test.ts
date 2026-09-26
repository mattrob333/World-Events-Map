import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import type { Itinerary } from '@/lib/designer/itinerary';
import { tripListRow } from './MyTrips';

const days = (start: string) => [0, 1].map((index) => ({ index, date: `${start.slice(0, 8)}${String(Number(start.slice(8)) + index).padStart(2, '0')}`, title: '', hype: '', slots: [] })) as unknown as Itinerary['days'];
const trip = (over: Partial<Itinerary> = {}): Itinerary => ({
  id: 't1', destination: 'custom', place: { name: 'Park City' } as Itinerary['place'], startDate: '2027-02-12', nights: 4,
  participants: [], days: days(over.startDate ?? '2027-02-12'), engine: 'on-device' as Itinerary['engine'], createdAt: '2026-09-26T00:00:00Z',
  ...over,
});

describe('your trips list', () => {
  it('names the place, the nights, the dates and how far out it is', () => {
    const row = tripListRow(trip(), true, new Date('2026-09-26T12:00:00Z'));
    expect(row.title).toBe('Park City · 4 nights');
    expect(row.status).toMatch(/^In \d+ days$/);
    expect(row.current).toBe(true);
  });
  it('calls a trip with no days yet in progress, and a finished one past', () => {
    expect(tripListRow(trip({ days: [] }), false, new Date('2026-09-26T12:00:00Z')).status).toBe('In progress');
    expect(tripListRow(trip({ startDate: '2025-01-10', days: days('2025-01-10') }), true, new Date('2026-09-26T12:00:00Z')).status).toBe('Past trip');
  });
});
