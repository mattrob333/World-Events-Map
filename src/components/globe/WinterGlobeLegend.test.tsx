import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Beacon } from '@/lib/types';
import { WinterGlobeLegend } from './WinterGlobeLegend';

const beacon = (eventId: string, category: Beacon['category'], city: string): Beacon => ({
  eventId,
  category,
  city,
  label: `${city} winter gathering`,
  coords: { lat: 46, lon: 7 },
  score: 70,
  heat: 'warm',
  relevance: 1,
  daysUntil: 18,
  focused: false,
  peerCount: 0,
});

describe('winter globe legend', () => {
  it('labels only ski markers and explains that conditions are not live', () => {
    const html = renderToStaticMarkup(createElement(WinterGlobeLegend, {
      beacons: [
        beacon('verbier', 'ski', 'Verbier'),
        beacon('zermatt', 'ski', 'Zermatt'),
        beacon('venice', 'art', 'Venice'),
      ],
    }));

    expect(html).toContain('2 SKI SCENES');
    expect(html).toContain('aria-label="Ski events on the globe"');
    expect(html).toContain('Verbier winter gathering, Verbier');
    expect(html).toContain('Zermatt winter gathering, Zermatt');
    expect(html).not.toContain('Venice winter gathering');
    expect(html).toContain('do not indicate live snow or mountain conditions');
    expect(html).toContain('NOT SNOW CONDITIONS');
  });

  it('does not show a winter key when no ski event is visible', () => {
    const html = renderToStaticMarkup(createElement(WinterGlobeLegend, {
      beacons: [beacon('venice', 'art', 'Venice')],
    }));
    expect(html).toBe('');
  });
});
