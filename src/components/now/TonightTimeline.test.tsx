import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PulseVenue } from '@/lib/now/pulse';
import { buildTonight } from '@/lib/now/tonight';
import { TonightTimeline } from './TonightTimeline';

const hourly = Array.from({ length: 24 }, () => 60);
const venue = (id: string, extra: Partial<PulseVenue> = {}): PulseVenue => ({ id, name: id, category: 'BAR', lat: 0, lng: 0, busyness: 60, basis: 'forecast', hourly, ...extra });
const render = (venues: PulseVenue[]) =>
  renderToStaticMarkup(<TonightTimeline tonight={buildTonight(venues, 22 * 60)} selected={null} onPick={() => {}} winks={new Map()} />);

describe('TonightTimeline', () => {
  it('draws the hourly columns as the chart, with a key, when a place has them', () => {
    const html = render([venue('Known', { closesMinutes: 26 * 60 })]);
    expect(html).toContain('Each column is an hour');
    expect(html).toContain('till 2am');
    expect(html).not.toContain('data-unknown');
  });

  it('marks the columns as unconfirmed when the closing time is unknown', () => {
    const html = render([venue('Mystery')]);
    expect(html).toContain('hours unknown');
    expect(html).toContain('data-unknown="true"');
    expect(html).toContain('opening hours unknown');
  });

  it('keeps the plain open-hours bar, and no key, without hourly data', () => {
    const html = render([venue('Plain', { closesMinutes: 26 * 60, hourly: undefined })]);
    expect(html).not.toContain('Each column is an hour');
    expect(html).not.toContain('role="img"');
  });
});
