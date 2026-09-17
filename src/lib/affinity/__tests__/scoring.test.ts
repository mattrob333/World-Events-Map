import { describe, expect, it } from 'vitest';
import { affinityScore } from '../scoring';

describe('affinityScore', () => {
  it('rewards shared trip context without requiring identical profiles', () => {
    const result = affinityScore(
      {
        interests: [
          { name: 'skiing', weight: 5 },
          { name: 'food', weight: 3 },
          { name: 'family travel', weight: 4 },
        ],
        partyType: 'family',
        originCity: 'Atlanta',
        originAirport: 'KATL',
        destination: 'Aspen',
        startDate: '2027-02-12',
        endDate: '2027-02-18',
      },
      {
        interests: [
          { name: 'skiing', weight: 5 },
          { name: 'family travel', weight: 5 },
          { name: 'golf', weight: 2 },
        ],
        partyType: 'family',
        originCity: 'Atlanta',
        destination: 'Aspen, Colorado',
        startDate: '2027-02-15',
        endDate: '2027-02-20',
      },
    );

    expect(result.score).toBeGreaterThan(65);
    expect(result.reasons.map((reason) => reason.kind)).toEqual(
      expect.arrayContaining(['interest', 'party', 'origin', 'destination', 'dates']),
    );
  });

  it('does not manufacture affinity when context does not overlap', () => {
    const result = affinityScore(
      {
        interests: [{ name: 'skiing', weight: 5 }],
        partyType: 'family',
        originCity: 'Atlanta',
        destination: 'Aspen',
      },
      {
        interests: [{ name: 'nightlife', weight: 5 }],
        partyType: 'solo',
        originCity: 'Paris',
        destination: 'Tokyo',
      },
    );

    expect(result.score).toBe(0);
    expect(result.reasons).toHaveLength(0);
  });

  it('treats mixed party type as partial compatibility', () => {
    const result = affinityScore(
      { interests: [], partyType: 'mixed' },
      { interests: [], partyType: 'friends' },
    );
    expect(result.score).toBe(6);
  });
});
