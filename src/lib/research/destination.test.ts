import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { CAP_MICRO, researchDestination, resetResearchCacheForTests } from './destination';
import {
  aboutPlace,
  hiddenGems,
  mentions,
  parseFlights,
  parseGoogleEvents,
  parseGoogleMaps,
  parseInstagram,
  parseTikTok,
  parseTripadvisor,
  parseYelp,
  tiktokThumbnail,
} from './destinationSources';

const NOW = Date.UTC(2026, 8, 24, 4, 0, 0);
const recent = NOW / 1000 - 3600;

const mapsJson = (items: unknown[]) => ({ output: { found: true, data: { items } } });
const castle = {
  name: 'Castelo de São Jorge', placeId: 'ChIJcastle', url: 'https://www.google.com/maps/place/data=!3m1', rating: 4.5, reviewCount: 103250,
  category: 'Tourist attraction', address: 'R. de Santa Cruz do Castelo, Lisboa', latitude: 38.7139, longitude: -9.1334,
  image: 'https://lh3.googleusercontent.com/gps-cs-s/abc=w203-h130-k-no', permanentlyClosed: false,
};
const tasca = { ...castle, name: 'Tasca do Chico', placeId: 'ChIJtasca', rating: 4.7, reviewCount: 640, category: 'Fado venue', image: 'https://evil.example/pic.jpg' };

beforeEach(() => resetResearchCacheForTests());

it('reads Google Maps places, keeps only Google photos, and resizes the same photo', () => {
  const spots = parseGoogleMaps(mapsJson([castle, tasca, { ...castle, placeId: 'closed', permanentlyClosed: true }, { name: 'No link' }]));
  expect(spots.map((spot) => spot.name)).toEqual(['Castelo de São Jorge', 'Tasca do Chico']);
  expect(spots[0].image?.url).toBe('https://lh3.googleusercontent.com/gps-cs-s/abc=w480-h360-k-no');
  expect(spots[0].url).toContain('query_place_id=ChIJcastle');
  expect(spots[1].image).toBeUndefined();
});

it('calls a spot a hidden gem only by the stated rating and review rule', () => {
  const spots = parseGoogleMaps(mapsJson([castle, tasca, { ...tasca, placeId: 'tiny', reviewCount: 4 }]));
  expect(hiddenGems(spots, new Set()).map((spot) => spot.name)).toEqual(['Tasca do Chico']);
  expect(hiddenGems(spots, new Set(['gm:ChIJtasca']))).toEqual([]);
});

it('keeps Tripadvisor sights but drops bookable tour products and foreign links', () => {
  const spots = parseTripadvisor({ places: [
    { place_type: 'ATTRACTION', title: 'Alfama', place_id: '195649', link: 'https://www.tripadvisor.com/Attraction_Review-g189158-d195649', rating: 4.5, reviews: 21494, thumbnail: 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/a.jpg' },
    { place_type: 'ATTRACTION_PRODUCT', title: 'Tuk Tuk Tour', place_id: '1', link: 'https://www.tripadvisor.com/AttractionProductReview-1' },
    { place_type: 'ATTRACTION', title: 'Phish', place_id: '2', link: 'https://tripadvisor.com.evil.test/x' },
  ] });
  expect(spots).toHaveLength(1);
  expect(spots[0]).toMatchObject({ name: 'Alfama', source: 'Tripadvisor', reviews: 21494 });
  expect(spots[0].image?.url).toContain('tripadvisor.com');
});

it('reads Yelp results with price, categories and a Yelp-hosted photo', () => {
  const [spot] = parseYelp({ organic_results: [{
    title: 'Restaurante Duque', link: 'https://www.yelp.com/biz/restaurante-duque-lisboa?osq=Restaurants', rating: 4.7, reviews: 306, price: '€€',
    categories: [{ title: 'Portuguese' }], neighborhoods: 'Chiado', snippet: 'Hole in the wall…', thumbnail: 'https://s3-media0.fl.yelpcdn.com/bphoto/x/ls.jpg',
  }] });
  expect(spot).toMatchObject({ name: 'Restaurante Duque', url: 'https://www.yelp.com/biz/restaurante-duque-lisboa', price: '€€', category: 'Portuguese' });
  expect(spot.image?.url).toContain('yelpcdn.com');
});

it('matches place names as words, ignoring accents, and not inside hashtags', () => {
  expect(mentions('Sunset over Lisboa', 'Lisboa')).toBe(true);
  expect(mentions('Castelo de Sao Jorge at dusk', 'Castelo de São Jorge')).toBe(true);
  expect(mentions('Lisbonite vibes', 'Lisbon')).toBe(false);
  expect(aboutPlace('Big sale this weekend! #lisbon #portugal', undefined, ['Lisbon'])).toBe(false);
  expect(aboutPlace('Big sale #lisbon', 'Lisbon, Portugal', ['Lisbon'])).toBe(true);
});

it('keeps Instagram posts that are really about the place, with their own photo', () => {
  const post = (over: Record<string, unknown>) => ({
    url: 'https://www.instagram.com/p/Abc123/', username: 'traveler', caption: 'Golden hour in Lisbon', createdUtc: recent,
    media: [{ type: 'photo', url: 'https://scontent-arn2-1.cdninstagram.com/v/t51/photo.jpg?oe=1' }], ...over,
  });
  const posts = parseInstagram({ output: { data: { posts: [
    post({}),
    post({ url: 'https://www.instagram.com/p/Ad1/', caption: 'Flash sale! #lisbon', paidPartnership: false }),
    post({ url: 'https://www.instagram.com/p/Paid/', paidPartnership: true }),
    post({ url: 'https://www.instagram.com/p/Old/', createdUtc: recent - 90 * 86400 }),
    post({ url: 'https://www.instagram.com/p/Loc/', caption: '#lisbon', locationName: 'Lisbon, Portugal', media: [{ type: 'photo', url: 'https://evil.test/x.jpg' }] }),
  ] } } }, 'Lisbon', ['Lisbon'], NOW);
  expect(posts.map((p) => p.url)).toEqual(['https://www.instagram.com/p/Abc123/', 'https://www.instagram.com/p/Loc/']);
  expect(posts[0].image?.url).toContain('cdninstagram.com');
  expect(posts[1].image).toBeUndefined();
});

it('builds TikTok links from validated ids and reads cover images only from TikTok hosts', () => {
  const posts = parseTikTok({ output: { data: { videos: [
    { author: 'queens_club', id: '7688930406057495838', caption: '24 hours in Lisbon #LisbonTips', createdUtc: recent, views: 167 },
    { author: 'bad author!', id: '7688930406057495839', caption: 'Lisbon', createdUtc: recent },
    { author: 'other', id: '7688930406057495840', caption: 'Nothing to do with it', createdUtc: recent },
  ] } } }, 'Lisbon', ['Lisbon'], NOW);
  expect(posts).toHaveLength(1);
  expect(posts[0]).toMatchObject({ url: 'https://www.tiktok.com/@queens_club/video/7688930406057495838', views: 167 });
  expect(tiktokThumbnail({ thumbnail_url: 'https://p16-common-sign.tiktokcdn-us.com/a.image?x-expires=1' })).toContain('tiktokcdn-us.com');
  expect(tiktokThumbnail({ thumbnail_url: 'https://evil.test/a.jpg' })).toBeUndefined();
});

it('reports an events outage instead of claiming there are no events', () => {
  expect(parseGoogleEvents({ tasks: [{ status_code: 50304, result: null }] })).toBeNull();
  const events = parseGoogleEvents({ tasks: [{ status_code: 20000, result: [{ items: [
    { type: 'event_item', title: 'Fado night', url: 'https://example.pt/fado', event_dates: { displayed_dates: 'Fri, Oct 2, 9 PM' }, location_info: { name: 'Clube de Fado' } },
    { type: 'event_item', title: 'No date', url: 'https://example.pt/x' },
  ] }] }] });
  expect(events).toEqual([expect.objectContaining({ title: 'Fado night', when: 'Fri, Oct 2, 9 PM', venue: 'Clube de Fado' })]);
});

it('reads fares cheapest first with the Google Flights link and typical range', () => {
  const leg = (from: string, to: string, time: string, airline: string) => ({ departure_airport: { id: from, time }, arrival_airport: { id: to }, airline });
  const result = parseFlights({
    best_flights: [
      { flights: [leg('JFK', 'MAD', '2026-10-15 16:55', 'Iberia'), leg('MAD', 'LIS', '2026-10-16 07:15', 'Iberia')], total_duration: 590, price: 721 },
      { flights: [leg('JFK', 'LIS', '2026-10-15 19:00', 'TAP Air Portugal')], total_duration: 410, price: 690 },
    ],
    price_insights: { typical_price_range: [490, 750] },
    search_metadata: { google_flights_url: 'https://www.google.com/travel/flights?tfs=abc' },
  });
  expect(result.flights.map((f) => [f.price, f.stops, f.airlines.join()])).toEqual([[690, 0, 'TAP Air Portugal'], [721, 1, 'Iberia']]);
  expect(result.typical).toEqual([490, 750]);
  expect(result.link).toBe('https://www.google.com/travel/flights?tfs=abc');
});

function fakeTreg() {
  const calls: string[] = [];
  const fetchImpl = vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.startsWith('https://www.tiktok.com/oembed')) return new Response(JSON.stringify({ thumbnail_url: 'https://p16.tiktokcdn.com/cover.image' }));
    const endpoint = new URL(url).pathname.replace('/call/', '');
    calls.push(endpoint);
    const headers = { 'x-treg-cost-micro': endpoint.startsWith('serpapi') ? '15000' : '1500', 'x-treg-call-id': `c${calls.length}` };
    const body = endpoint === 'anyapi.google.serp.maps' ? mapsJson([castle, tasca])
      : endpoint === 'anyapi.instagram.hashtag_recent_posts' ? { output: { data: { posts: [{ url: 'https://www.instagram.com/p/X1/', username: 'a', caption: 'Morning in Lisbon', createdUtc: recent }] } } }
        : endpoint === 'anyapi.tiktok.search.videos' ? { output: { data: { videos: [{ author: 'bee', id: '768893040605749583', caption: 'Lisbon food', createdUtc: recent }] } } }
          : endpoint.startsWith('dataforseo') ? { tasks: [{ status_code: 50304, result: null }] }
            : endpoint === 'serpapi.x.google-flights' ? { best_flights: [] }
              : { places: [], organic_results: [] };
    return new Response(JSON.stringify(body), { status: 200, headers });
  });
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
}

it('says it is not connected, and spends nothing, without a token', async () => {
  const { calls, fetchImpl } = fakeTreg();
  const research = await researchDestination({ name: 'Lisbon' }, { token: '', fetchImpl, now: () => NOW });
  expect(research.configured).toBe(false);
  expect(research.topSpots.status).toBe('unavailable');
  expect(calls).toEqual([]);
});

it('runs every source under the cap, labels outages, and serves repeats from cache', async () => {
  const { calls, fetchImpl } = fakeTreg();
  const req = { name: 'Lisbon', region: 'Portugal', flight: { from: 'JFK', to: 'LIS', depart: '2026-10-15', return: '2026-10-20' } };
  const research = await researchDestination(req, { token: 'k', fetchImpl, now: () => NOW });
  expect(research.configured).toBe(true);
  expect(research.topSpots.items[0].name).toBe('Castelo de São Jorge');
  expect(research.hiddenGems.items.map((spot) => spot.name)).toEqual(['Tasca do Chico']);
  expect(research.instagram.status).toBe('ok');
  expect(research.tiktok.items[0].image?.url).toBe('https://p16.tiktokcdn.com/cover.image');
  expect(research.events.status).toBe('unavailable');
  expect(research.flights.status).toBe('empty');
  expect(research.spentUsd * 1_000_000).toBeLessThanOrEqual(CAP_MICRO + 20_000);
  expect(calls.filter((c) => c.startsWith('serpapi')).length).toBe(3);
  const before = calls.length;
  const again = await researchDestination(req, { token: 'k', fetchImpl, now: () => NOW + 60_000 });
  expect(calls.length).toBe(before);
  expect(again.spentUsd).toBe(0);
});

it('stops starting paid calls once the run would pass its cap', async () => {
  const { calls, fetchImpl } = fakeTreg();
  const research = await researchDestination({ name: 'Porto' }, { token: 'k', fetchImpl, now: () => NOW });
  const reserved = calls.reduce((sum, endpoint) => sum + (endpoint.startsWith('serpapi') ? 20_000 : 5_000), 0);
  expect(reserved).toBeLessThanOrEqual(CAP_MICRO);
  expect(research.spentUsd).toBeGreaterThan(0);
});
