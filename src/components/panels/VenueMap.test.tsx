import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GOLF_EVENTS } from '@/lib/data/events/golf';
import { SKI_EVENTS } from '@/lib/data/events/ski';
import { VenueMap } from './VenueMap';

describe('VenueMap mountain handoff', () => {
  it('shows satellite and terrain links for a ski event with approximate-location language', () => {
    const html = renderToStaticMarkup(createElement(VenueMap, { event: SKI_EVENTS[0] }));

    expect(html).toContain('View satellite imagery');
    expect(html).toContain('Explore terrain &amp; contours');
    expect(html).toContain('map_action=map');
    expect(html).toContain('basemap=satellite');
    expect(html).toContain('basemap=terrain');
    expect(html).toContain('approximate event area, not a verified lift or venue entrance');
    expect(html).not.toContain('Street View');
  });

  it('keeps the Street View handoff for other events', () => {
    const html = renderToStaticMarkup(createElement(VenueMap, { event: GOLF_EVENTS[0] }));

    expect(html).toContain('Street View');
    expect(html).not.toContain('basemap=satellite');
    expect(html).not.toContain('basemap=terrain');
  });

  it('does not offer mountain links for invalid event coordinates', () => {
    const html = renderToStaticMarkup(createElement(VenueMap, {
      event: { ...SKI_EVENTS[0], coords: { lat: Number.NaN, lon: 7 } },
    }));

    expect(html).not.toContain('basemap=satellite');
    expect(html).not.toContain('basemap=terrain');
  });
});
