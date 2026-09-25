import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WorldIntro } from './WorldIntro';

const renderMode = (season: 'winter' | 'summer', interest: 'ski' | 'coast') =>
  renderToStaticMarkup(createElement(WorldIntro, {
    origin: null,
    originName: null,
    onTravel: () => {},
    season,
    interest,
  }));

describe('trip mode on the world intro', () => {
  it('keeps a winter ski link’s shortlist, without the trip finder (it lives in trip planning)', () => {
    const html = renderMode('winter', 'ski');
    expect(html).toContain('Ski weeks worth planning.');
    expect(html).not.toContain('What kind of trip calls to you?');
  });

  it('keeps summer coast context', () => {
    const html = renderMode('summer', 'coast');
    expect(html).toContain('Days by the water.');
    expect(html).not.toContain('Ski weeks worth planning.');
  });
});
