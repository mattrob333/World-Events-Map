import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WorldIntro } from './WorldIntro';

const renderMode = (season: 'winter' | 'summer', interest: 'ski' | 'coast') =>
  renderToStaticMarkup(createElement(WorldIntro, {
    origin: null,
    originName: null,
    onTravel: () => {},
    onModeChange: () => {},
    season,
    interest,
  }));

describe('trip mode handoff from the world intro', () => {
  it('takes a winter ski trip to the visible family ski planner', () => {
    const html = renderMode('winter', 'ski');
    expect(html).toContain('/trips?season=winter&amp;interest=ski#family-ski');
    expect(html).toContain('Start a family ski trip');
    expect(html).toContain('Ski weeks worth planning.');
  });

  it('keeps summer coast context without opening the winter planner', () => {
    const html = renderMode('summer', 'coast');
    expect(html).toContain('/trips?season=summer&amp;interest=coast');
    expect(html).not.toContain('#family-ski');
    expect(html).toContain('Days by the water.');
    expect(html).not.toContain('Ski weeks worth planning.');
  });
});
