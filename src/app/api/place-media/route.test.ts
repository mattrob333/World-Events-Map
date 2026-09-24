import { describe, expect, it, vi } from 'vitest';
import { GET } from './route';

describe('/api/place-media', () => {
  it('rejects arbitrary queries and unknown events before network access', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    try {
      const unsafe = await GET(new Request('https://example.test/api/place-media?eventId=https://evil.test'));
      const missing = await GET(new Request('https://example.test/api/place-media?eventId=not-a-curated-event'));
      expect(unsafe.status).toBe(400);
      expect(missing.status).toBe(404);
      expect(fetcher).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('leads with reviewed scene photos even when Commons search has no matches', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ query: { pages: [] } }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    try {
      for (const [eventId, subject] of [
        ['laver-cup', 'event'],
        ['aspen-christmas-week', 'place'],
        ['monaco-yacht-show', 'event'],
      ]) {
        const response = await GET(new Request(`https://example.test/api/place-media?eventId=${eventId}`));
        const body = await response.json();
        expect(body.photos).toHaveLength(1);
        expect(body.photos[0]).toMatchObject({ imageUrl: `/editorial/${eventId}.jpg`, subject });
        expect(body.photos[0].sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      }
      expect(fetcher).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('lets the browser and CDN cache found photos, and asks Commons for a standard width', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ query: { pages: [] } }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    try {
      const response = await GET(new Request('https://example.test/api/place-media?eventId=white-turf-st-moritz'));
      expect(response.headers.get('Cache-Control')).toMatch(/s-maxage=\d+/);
      expect(response.headers.get('Cache-Control')).toMatch(/stale-while-revalidate=\d+/);
      const url = new URL(String(fetcher.mock.calls[0][0]));
      expect(url.searchParams.get('iiurlwidth')).toBe('1280');
      expect(url.searchParams.get('iiprop')).toContain('size');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('coalesces simultaneous searches for an event without a reviewed photo', async () => {
    const page = (n: number) => ({
      title: `File:Newport Jazz Festival 2026 ${n}.jpg`,
      imageinfo: [{
        mime: 'image/jpeg',
        thumburl: `https://upload.wikimedia.org/wikipedia/commons/${n}/photo.jpg`,
        descriptionurl: `https://commons.wikimedia.org/wiki/File:Newport_Jazz_Festival_2026_${n}.jpg`,
        extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' } },
      }],
    });
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ query: { pages: [page(1), page(2)] } }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    try {
      const url = 'https://example.test/api/place-media?eventId=newport-jazz-festival';
      const [first, second] = await Promise.all([GET(new Request(url)), GET(new Request(url))]);
      expect((await first.json()).photos).toHaveLength(2);
      expect((await second.json()).photos).toHaveLength(2);
      // One event search and one place search, shared by both requests.
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('does not represent a Hahnenkamm sign as event coverage', async () => {
    const sign = { title: 'File:Kitzbühel Hahnenkamm Stadtpark Steinbock-Darstellung mit Schriftzug.jpg',
      imageinfo: [{ mime: 'image/jpeg', thumburl: 'https://upload.wikimedia.org/wikipedia/commons/a/sign.jpg',
        descriptionurl: 'https://commons.wikimedia.org/wiki/File:Hahnenkamm_sign.jpg',
        extmetadata: { LicenseShortName: { value: 'CC BY 4.0' } } }],
    };
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ query: { pages: [sign] } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ query: { pages: [] } }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    try {
      const response = await GET(new Request('https://example.test/api/place-media?eventId=hahnenkamm-kitzbuhel'));
      expect((await response.json()).photos).toMatchObject([
        { imageUrl: '/editorial/hahnenkamm-kitzbuhel.jpg', subject: 'event' },
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
