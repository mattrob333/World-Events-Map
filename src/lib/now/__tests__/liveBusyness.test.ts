import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { parseLive, validVenueId } from '../liveBusyness';

const at = new Date('2026-09-26T23:46:00Z');

describe('BestTime live reading', () => {
  it('reads live, usual and the difference', () => {
    const reading = parseLive('ven_abc123', { status: 'OK', analysis: { venue_live_busyness: 78, venue_live_busyness_available: true, venue_forecasted_busyness: 52, venue_forecast_busyness_available: true, venue_live_forecasted_delta: 26, hour_start_12: '6PM', hour_end_12: '7PM' } }, at);
    expect(reading).toEqual({ venueId: 'ven_abc123', live: 78, usual: 52, delta: 26, hour: '6PM–7PM', checkedAt: at.toISOString() });
  });

  it('never fills a missing live reading from the forecast', () => {
    const reading = parseLive('ven_abc123', { status: 'OK', analysis: { venue_live_busyness: 0, venue_live_busyness_available: false, venue_forecasted_busyness: 40, venue_forecast_busyness_available: true } }, at);
    expect(reading?.live).toBeUndefined();
    expect(reading?.delta).toBeUndefined();
    expect(reading?.usual).toBe(40);
  });

  it('rejects errors and odd input', () => {
    expect(parseLive('ven_abc123', { status: 'Error', message: 'x' })).toBeNull();
    expect(parseLive('ven_abc123', null)).toBeNull();
    expect(parseLive('ven_abc123', { status: 'OK', analysis: { venue_live_busyness: 'lots', venue_live_busyness_available: true } })?.live).toBeUndefined();
    expect(validVenueId('ven_51387131543761435650505241346a394a6432395362654a496843')).toBe(true);
    expect(validVenueId('../../etc')).toBe(false);
    expect(validVenueId('a b')).toBe(false);
  });
});
