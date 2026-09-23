import { describe, expect, it } from 'vitest';
import { buildPrivateSkiBrief, buildPublicSkiCircle, validateFamilySkiInput, type FamilySkiInput } from './familySki';
import { circleInvitePath, circleInviteUrl } from '@/lib/trips/circleInvite';

const sample: FamilySkiInput = {
  region: 'compare',
  start: '2027-02-12',
  end: '2027-02-19',
  origin: 'Atlanta',
  adults: 2,
  children: 2,
  anotherFamily: true,
  stay: 'slopeside',
  nightlyBudget: '1200',
};

describe('family ski Circle privacy boundary', () => {
  it('keeps household and budget details out of discoverable Circle fields and the invite URL', () => {
    const publicCircle = buildPublicSkiCircle(sample, 'host-id');
    const discoverable = JSON.stringify(publicCircle);
    const path = circleInvitePath('30000000-0000-0000-0000-000000000001');
    expect(discoverable).toContain('Colorado Rockies or Swiss Alps');
    expect(discoverable).not.toContain('Atlanta');
    expect(discoverable).not.toContain('1200');
    expect(discoverable).not.toContain('Ski-in/ski-out');
    expect(publicCircle.departure_city).toBe('');
    expect(path).toBe('/community?circle=30000000-0000-0000-0000-000000000001');
    expect(circleInviteUrl('https://meridian.example', '30000000-0000-0000-0000-000000000001')).toBe(`https://meridian.example${path}`);
    expect(path).not.toContain('Atlanta');
  });

  it('puts the preferences in a member-only opening brief', () => {
    const brief = buildPrivateSkiBrief(sample);
    expect(brief).toContain('Atlanta');
    expect(brief).toContain('2 adults, 2 children');
    expect(brief).toContain('Another family');
    expect(brief).toContain('Ski-in/ski-out');
    expect(brief).toContain('$1200 per night');
  });

  it('rejects reversed dates and malformed invite identifiers', () => {
    expect(validateFamilySkiInput({ ...sample, end: '2027-02-01' })).toMatch(/end date/);
    expect(circleInvitePath('30000000-0000-0000-0000-000000000001&origin=Atlanta')).toBeNull();
  });
});
