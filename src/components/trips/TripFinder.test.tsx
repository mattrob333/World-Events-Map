import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TripFinder } from './TripFinder';

describe('TripFinder', () => {
  it('asks what kind of trip calls to them, with season and interest choices', () => {
    const html = renderToStaticMarkup(createElement(TripFinder, {}));
    expect(html).toContain('What kind of trip calls to you?');
    expect(html).toContain('Every season');
    expect(html).toContain('Ski &amp; snow');
  });
});
