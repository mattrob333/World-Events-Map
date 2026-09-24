import { describe, expect, it } from 'vitest';
import { resumeTarget } from './resume';

const trip = (first: string, last: string) => ({
  destination: 'custom' as const,
  place: { name: 'Lisbon', kind: 'city' as const },
  days: [
    { date: first, slots: [] },
    { date: last, slots: [] },
  ],
});

describe('resumeTarget', () => {
  it('opens an upcoming trip in the designer', () => {
    const target = resumeTarget(trip('2026-10-10', '2026-10-14') as never, new Date('2026-10-01T12:00:00'));
    expect(target?.href).toBe('/trips/designer');
    expect(target?.title).toBe('Your Lisbon trip');
    expect(target?.detail).toContain('9 days out');
  });

  it('skips a trip that is over', () => {
    expect(resumeTarget(trip('2026-09-01', '2026-09-05') as never, new Date('2026-09-24T12:00:00'))).toBeNull();
  });

  it('has nothing to resume without a trip', () => {
    expect(resumeTarget(null, new Date())).toBeNull();
  });
});
