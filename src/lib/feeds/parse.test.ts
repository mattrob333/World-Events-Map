import { describe, expect, it } from 'vitest';
import { EXCERPT_MAX, parseFeed, plainText } from './parse';

const rss = `<?xml version="1.0"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>Mag</title>
<item><title><![CDATA[Tokyo's new <b>rooftop</b> bar]]></title><link>https://example.com/tokyo-bar</link>
<pubDate>Wed, 23 Sep 2026 21:32:04 +0000</pubDate><description><![CDATA[<p>A rooftop &amp; listening bar opens in Shibuya.</p><script>alert(1)</script>]]></description></item>
<item><title>No link</title></item>
<item><title>Dated with dc</title><guid>https://example.com/dc</guid><dc:date>2026-09-22T10:00:00Z</dc:date></item>
</channel></rss>`;

const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Blog</title>
<entry><title type="html">Powder day &#8211; Niseko</title><link rel="self" href="https://blog.example/self"/><link rel="alternate" href="https://blog.example/niseko"/>
<updated>2026-09-20T08:00:00Z</updated><summary>First snow.</summary></entry></feed>`;

describe('feed parser', () => {
  it('reads RSS items, strips markup and scripts, and drops items without links', () => {
    const entries = parseFeed(rss);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      title: "Tokyo's new rooftop bar",
      url: 'https://example.com/tokyo-bar',
      publishedAt: '2026-09-23T21:32:04.000Z',
      excerpt: 'A rooftop & listening bar opens in Shibuya.',
    });
    expect(entries[1]!.publishedAt).toBe('2026-09-22T10:00:00.000Z');
  });

  it('reads Atom entries and prefers the alternate link', () => {
    expect(parseFeed(atom)).toEqual([{ title: 'Powder day – Niseko', url: 'https://blog.example/niseko', publishedAt: '2026-09-20T08:00:00.000Z', excerpt: 'First snow.' }]);
  });

  it('caps excerpts to a short quote', () => {
    const long = `<rss><channel><item><title>T</title><link>https://x.example/a</link><description>${'word '.repeat(200)}</description></item></channel></rss>`;
    const [entry] = parseFeed(long);
    expect(entry!.excerpt.length).toBeLessThanOrEqual(EXCERPT_MAX);
    expect(entry!.excerpt.endsWith('…')).toBe(true);
  });

  it('never keeps non-web links', () => {
    expect(parseFeed('<rss><item><title>T</title><link>javascript:alert(1)</link></item></rss>')).toEqual([]);
    expect(plainText('&lt;b&gt;x&lt;/b&gt;')).toBe('x');
  });
});
