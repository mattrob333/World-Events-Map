import { describe, expect, it } from 'vitest';
import { ogImageFrom } from './ogImage';

describe('ogImageFrom', () => {
  it('reads og:image in either attribute order', () => {
    expect(ogImageFrom('<meta property="og:image" content="https://cdn.example.com/a.jpg">', 'https://example.com/story')).toBe('https://cdn.example.com/a.jpg');
    expect(ogImageFrom("<meta content='https://cdn.example.com/b.jpg?w=1200&amp;h=630' name='twitter:image' />", 'https://example.com/story')).toBe('https://cdn.example.com/b.jpg?w=1200&h=630');
  });
  it('resolves relative images against the story', () => {
    expect(ogImageFrom('<meta property="og:image" content="/img/c.webp">', 'https://example.com/story')).toBe('https://example.com/img/c.webp');
  });
  it('skips logos, svgs and plain http', () => {
    expect(ogImageFrom('<meta property="og:image" content="https://example.com/logo.png">', 'https://example.com/s')).toBeNull();
    expect(ogImageFrom('<meta property="og:image" content="https://example.com/x.svg">', 'https://example.com/s')).toBeNull();
    expect(ogImageFrom('<meta property="og:image" content="http://example.com/x.jpg">', 'https://example.com/s')).toBeNull();
    expect(ogImageFrom('<html></html>', 'https://example.com/s')).toBeNull();
  });
});
