import { describe, expect, it } from 'vitest';
import { brandFor, glyphOn } from './brand';

describe('brandFor', () => {
  it.each([
    ['https://www.youtube.com/watch?v=abc', 'youtube'],
    ['youtu.be/abc', 'youtube'],
    ['https://www.instagram.com/p/xyz', 'instagram'],
    ['tiktok.com', 'tiktok'],
    ['https://twitter.com/a/status/1', 'x'],
    ['https://maps.google.com/?q=x', 'googlemaps'],
    ['https://www.google.com/maps/place/x', 'googlemaps'],
    ['https://www.google.com/search?q=x', 'google'],
    ['https://news.google.com/x', 'googlenews'],
    ['https://www.tripadvisor.co.uk/x', 'tripadvisor'],
    ['https://upload.wikimedia.org/a.jpg', 'wikimediacommons'],
    ['https://en.wikipedia.org/wiki/Kyoto', 'wikipedia'],
    ['https://www.opentable.com/r/x', 'opentable'],
    ['https://m.uber.com/ul/?x', 'uber'],
    ['Google Maps', 'googlemaps'],
    ['Wikipedia views', 'wikipedia'],
    ['ticketmaster', 'ticketmaster'],
    ['SeatGeek', 'seatgeek'],
    ['Wikimedia Commons', 'wikimediacommons'],
  ])('%s → %s', (input, slug) => {
    expect(brandFor(input)?.slug).toBe(slug);
  });

  it('does not guess at unknown sources', () => {
    expect(brandFor('https://www.chezvrony.ch')).toBeNull();
    expect(brandFor('Our news desk')).toBeNull();
    expect(brandFor('')).toBeNull();
    // A lookalike host is not the brand.
    expect(brandFor('https://notyoutube.com.evil.io')).toBeNull();
  });

  it('uses a monogram, not an imitation, for brands without an official mark', () => {
    expect(brandFor('https://www.eventbrite.com/e/1')).toMatchObject({ kind: 'monogram', letter: 'e' });
  });
});

describe('glyphOn', () => {
  it('puts dark glyphs on light brand colors and white on dark ones', () => {
    expect(glyphOn('#1ED760')).toBe('#0b0b0b');
    expect(glyphOn('#FF0000')).toBe('#ffffff');
    expect(glyphOn('#000000')).toBe('#ffffff');
  });
});
