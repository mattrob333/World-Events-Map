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

  it('coalesces simultaneous requests for the same curated event', async () => {
    const page = (n: number) => ({
      title: `File:Oktoberfest Munich ${n}.jpg`,
      imageinfo: [{
        mime: 'image/jpeg',
        thumburl: `https://upload.wikimedia.org/wikipedia/commons/${n}/photo.jpg`,
        descriptionurl: `https://commons.wikimedia.org/wiki/File:Oktoberfest_Munich_${n}.jpg`,
        extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' } },
      }],
    });
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ query: { pages: [page(1), page(2)] } }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    try {
      const url = 'https://example.test/api/place-media?eventId=oktoberfest-munich';
      const [first, second] = await Promise.all([GET(new Request(url)), GET(new Request(url))]);
      expect((await first.json()).photos).toHaveLength(2);
      expect((await second.json()).photos).toHaveLength(2);
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('finds Monaco Yacht Show photos despite the catalog city name Monte-Carlo', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ query: { pages: [{
      title: 'File:Monaco Yacht Show 2025.jpg',
      imageinfo: [{ mime: 'image/jpeg', thumburl: 'https://upload.wikimedia.org/wikipedia/commons/m/yacht.jpg',
        descriptionurl: 'https://commons.wikimedia.org/wiki/File:Monaco_Yacht_Show_2025.jpg',
        extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' } } }],
    }] } }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    try {
      const response = await GET(new Request('https://example.test/api/place-media?eventId=monaco-yacht-show'));
      const body = await response.json();
      expect(body.photos[0]).toMatchObject({ subject: 'event', title: 'Monaco Yacht Show 2025' });
      const query = new URL(fetcher.mock.calls[0][0]).searchParams.get('gsrsearch');
      expect(query).toBe('Monaco Yacht Show');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('puts Aspen ski imagery ahead of generic place photos without calling it event media', async () => {
    const skiPages = [
      'File:Aspen Art Museum.jpg',
      'File:Skiing Aspen Mountain.jpg',
    ].map((title, index) => ({ title,
      imageinfo: [{ mime: 'image/jpeg',
        thumburl: `https://upload.wikimedia.org/wikipedia/commons/${index}/aspen.jpg`,
        descriptionurl: `https://commons.wikimedia.org/wiki/${title.replaceAll(' ', '_')}`,
        extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' } },
      }],
    }));
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ query: { pages: [] } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ query: { pages: skiPages } }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    try {
      const response = await GET(new Request('https://example.test/api/place-media?eventId=aspen-christmas-week'));
      const body = await response.json();
      expect(body.photos[0]).toMatchObject({ subject: 'place', title: 'Skiing Aspen Mountain' });
      expect(new URL(fetcher.mock.calls[1][0]).searchParams.get('gsrsearch')).toBe('Aspen skiing Colorado');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
