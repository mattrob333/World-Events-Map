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

  it('opens Aspen with distinct credited local scenes and visible food and mountain ideas', () => {
    const html = renderToStaticMarkup(createElement(DestinationPage, { slug: 'aspen' }));
    expect(html).toContain('A place worth the journey'.toUpperCase());
    expect(html).toContain('/editorial/destination-aspen-hero.jpg');
    expect(html).toContain('/editorial/aspen-christmas-week.jpg');
    expect(html).toContain('/editorial/destination-aspen-street.jpg');
    expect(html).toContain('Cloud Nine Alpine Bistro');
    expect(html).toContain('Highlands Bowl hike');
    expect(html).toContain('Sample editorial pick');
    expect(html).toContain('https://commons.wikimedia.org/wiki/File:Aspen_panorama_(8552886075).jpg');
  });

  it('keeps Courchevel imagery local to Courchevel', () => {
    const html = renderToStaticMarkup(createElement(DestinationPage, { slug: 'courchevel' }));
    expect(html).toContain('/editorial/courchevel-peak-week.jpg');
    expect(html).toContain('/editorial/destination-courchevel-village.jpg');
    expect(html).not.toContain('/editorial/aspen-christmas-week.jpg');
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
