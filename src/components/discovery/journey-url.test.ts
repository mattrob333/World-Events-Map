import { describe, expect, it } from 'vitest';
import { discoveryQuery, readDiscoveryState } from './journey-url';

describe('discovery state in the URL (UFR-A06, B05)', () => {
  it('reads valid season, interest and journey and ignores junk', () => {
    expect(readDiscoveryState(new URLSearchParams('season=winter&interest=ski&journey=aspen-christmas-week')))
      .toEqual({ season: 'winter', interest: 'ski', journey: 'aspen-christmas-week' });
    expect(readDiscoveryState(new URLSearchParams('season=monsoon&interest=<b>&journey=../x')))
      .toEqual({ season: 'all', interest: 'all', journey: null });
  });

  it('writes only non-default values and keeps unrelated params', () => {
    const current = new URLSearchParams('event=monaco-yacht-show');
    expect(discoveryQuery(current, { season: 'winter', interest: 'ski' })).toBe('?event=monaco-yacht-show&season=winter&interest=ski');
    expect(discoveryQuery(new URLSearchParams('season=winter&journey=aspen-christmas-week'), { journey: null })).toBe('?season=winter');
    expect(discoveryQuery(new URLSearchParams('season=winter'), { season: 'all' })).toBe('?');
  });
});
