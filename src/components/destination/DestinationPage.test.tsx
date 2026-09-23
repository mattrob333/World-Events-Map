import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CirclesIndex } from '@/components/trip-room/TripRoom';
import { DestinationPage } from './DestinationPage';

describe('destination to Circle planning handoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-22T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('plans the upcoming Monaco Yacht Show instead of opening an unrelated race-week sample', () => {
    const html = renderToStaticMarkup(createElement(DestinationPage, { slug: 'monte-carlo' }));
    expect(html).toContain('Monaco Yacht Show');
    expect(html).toContain('/circles?destination=monte-carlo&amp;event=monaco-yacht-show');
    expect(html).not.toContain('href="/circles/monaco-harbor"');
  });

  it('keeps the selected occasion and date above separately labeled fixture rooms', () => {
    const html = renderToStaticMarkup(createElement(CirclesIndex, {
      destination: 'monte-carlo', eventId: 'monaco-yacht-show',
    }));
    expect(html).toContain('Your selected occasion');
    expect(html).toContain('Monaco Yacht Show');
    expect(html).toContain('23 – 26 Sep 2026');
    expect(html).toContain('/community?event=monaco-yacht-show');
    expect(html).toContain('Other sample trips in Monte-Carlo');
    expect(html).toContain('Their events and dates may differ');
  });

  it('does not accept an event from another destination in the handoff', () => {
    const html = renderToStaticMarkup(createElement(CirclesIndex, {
      destination: 'monte-carlo', eventId: 'aspen-christmas-week',
    }));
    expect(html).not.toContain('Your selected occasion');
    expect(html).not.toContain('/community?event=aspen-christmas-week');
  });
});
