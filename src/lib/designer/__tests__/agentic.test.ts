import { describe, expect, it } from 'vitest';
import type { LiveEvent } from '../concerts';
import { isTeamGame, splitTeam } from '../concerts';
import { normalizeProfile } from '../profile';
import { decodeProfile, encodeProfile, importUrl } from '../share';
import { rankTripIdeas } from '../tripIdeas';

const ev = (id: string, kind: LiveEvent['kind'], city: string, date: string, extra: Partial<LiveEvent> = {}): LiveEvent => ({
  id, kind, city, date, source: 'ticketmaster', name: `${kind} ${id}`, url: `https://www.ticketmaster.com/e/${id}`, ...extra,
});

describe('profile share links', () => {
  it('round-trips a profile through the fragment and sanitizes it', () => {
    const profile = normalizeProfile({ hometown: 'Atlanta', teams: ['Atlanta Braves'], style: { social: 'meet-everyone', lodging: ['social hostel'], homeAirport: 'atl!' } });
    const decoded = decodeProfile(encodeProfile(profile));
    expect(decoded?.style).toMatchObject({ social: 'meet-everyone', homeAirport: 'ATL', lodging: ['social hostel'] });
    expect(importUrl('https://dope.travel/', profile)).toMatch(/^https:\/\/dope\.travel\/moodboard\/import#p=[A-Za-z0-9_-]+$/);
  });

  it('rejects garbage and oversized payloads', () => {
    expect(decodeProfile('not base64!')).toBeNull();
    expect(decodeProfile('a'.repeat(20_000))).toBeNull();
    expect(decodeProfile(btoa(JSON.stringify({ v: 2, profile: {} })))).toBeNull();
  });
});

describe('teams', () => {
  it('splits home and nickname and matches games', () => {
    expect(splitTeam('Atlanta Braves')).toEqual({ home: 'Atlanta', nickname: 'Braves' });
    expect(splitTeam('Boston Red Sox')).toEqual({ home: 'Boston', nickname: 'Red Sox' });
    expect(isTeamGame('Chicago Cubs vs. Atlanta Braves', [], 'Atlanta Braves')).toBe(true);
    expect(isTeamGame('Chicago Cubs vs. St. Louis Cardinals', [], 'Atlanta Braves')).toBe(false);
  });
});

describe('rankTripIdeas', () => {
  const events = [
    ev('f1', 'festival', 'Lisbon', '2027-06-19', { artist: 'Seu Jorge', lat: 38.77, lon: -9.1, country: 'PT' }),
    ev('a1', 'artist', 'Lisbon', '2027-06-21', { artist: 'Fleetwood Mac', lat: 38.72, lon: -9.14 }),
    ev('g1', 'game', 'Chicago', '2027-06-20', { team: 'Atlanta Braves', away: true }),
    ev('t1', 'tribute', 'Atlanta', '2027-06-20', { artist: 'Tom Petty' }),
    ev('a2', 'artist', 'Lisbon', '2027-09-01', { artist: 'Outkast' }),
  ];

  it('picks the best stretch per city and ranks mixes of things highest', () => {
    const ideas = rankTripIdeas(events, { excludeCity: 'Atlanta, Georgia' });
    expect(ideas[0]).toMatchObject({ city: 'Lisbon', start: '2027-06-18', end: '2027-06-22' });
    expect(ideas[0].events.map((e) => e.id)).toEqual(['f1', 'a1']);
    expect(ideas[0].why).toMatch(/with Seu Jorge on the bill/);
    expect(ideas.map((i) => i.city)).not.toContain('Atlanta');
  });

  it('boosts ideas that overlap a curated occasion nearby', () => {
    const occasion = { id: 'chi-fest', name: 'Chicago Summer Fest', city: 'Chicago', countryCode: 'US', start: '2027-06-19', end: '2027-06-22', lat: 41.88, lon: -87.63 };
    const without = rankTripIdeas(events).find((i) => i.city === 'Chicago')!;
    const withOcc = rankTripIdeas(events, { occasions: [occasion] }).find((i) => i.city === 'Chicago')!;
    expect(withOcc.score).toBeGreaterThan(without.score);
    expect(withOcc.why).toMatch(/during Chicago Summer Fest/);
  });
});
