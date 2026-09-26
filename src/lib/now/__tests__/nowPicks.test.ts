import { describe, expect, it } from 'vitest';
import { energyFit, picksSummary, rankNowPicks } from '../nowPicks';
import type { PulseVenue } from '../pulse';

const v = (id: string, busyness: number, extra: Partial<PulseVenue> = {}): PulseVenue => ({ id, name: id, category: 'BAR', lat: 40.76, lng: -73.83, busyness, basis: 'forecast', distanceMeters: 800, ...extra });

describe('Vibe Now ranking', () => {
  it('matches busyness to the energy they asked for', () => {
    expect(energyFit(90, 'lively')).toBeGreaterThan(energyFit(30, 'lively'));
    expect(energyFit(30, 'chill')).toBeGreaterThan(energyFit(90, 'chill'));
  });

  it('with "late", drops places closing within the hour and lifts ones open past midnight', () => {
    const picks = rankNowPicks([
      v('closing-soon', 90, { closesMinutes: 23 * 60 }),
      v('open-till-2', 60, { closesMinutes: 1560 }),
      v('unknown-hours', 60),
    ], { energy: 'lively', late: true, nowMinutes: 22 * 60 + 42 });
    expect(picks.map((p) => p.id)).toEqual(['open-till-2', 'unknown-hours']);
    expect(picks[0]!.closes).toBe('open till 2am');
  });

  it('treats 1am as part of last night', () => {
    const picks = rankNowPicks([v('till-2', 50, { closesMinutes: 1560 })], { energy: 'lively', late: true, nowMinutes: 60 });
    expect(picks).toHaveLength(1);
  });

  it('summarizes facts only, and says so when nothing is open', () => {
    expect(picksSummary([], 'Flushing')).toMatch(/Nothing open/);
    const [pick] = rankNowPicks([v('The Bar', 80, { basis: 'live', closesMinutes: 1560 })], { energy: 'lively', nowMinutes: 1300 });
    expect(picksSummary([pick!], 'Flushing')).toContain('80% busy right now; open till 2am');
  });
});
