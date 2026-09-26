import { describe, expect, it } from 'vitest';
import { laneFor, pickSmarter } from './lanes';

describe('travel smarter lanes', () => {
  it.each([
    ['Which Airport Lounges Offer Complimentary Spa Treatments?', 'lounges'],
    ['LAST DAY: Get a 100% bonus when you buy Hilton Honors hotel points', 'points'],
    ['PEAK SEASON Qatar Airways flights from New York to the Seychelles from $977', 'deals'],
    ['The best carry-on luggage for a week in Europe', 'gear'],
    ['The world’s best hostels for solo travelers in 2026', 'hostels'],
    ['Flight canceled or delayed? Here’s what to do next', 'tips'],
    ['Save on your safari: A first look at Marriott Bonvoy’s new Serengeti safari camp', 'points'],
  ])('%s → %s', (title, lane) => {
    expect(laneFor(title)).toBe(lane);
  });

  it('leaves out incidents and crime', () => {
    expect(laneFor('Frontier Passengers Refused To Pay An Extra Bag Fee And Boarded Anyway—Bodycam Shows Them Leaving In Handcuffs')).toBeNull();
    expect(laneFor('Ryanair flight declared mayday after coming within 10 minutes of running out of fuel')).toBeNull();
    expect(laneFor('Tourists duped by fake Wetherspoons listing on Booking.com')).toBeNull();
  });

  it('keeps it fresh, one story per publisher per lane', () => {
    const now = new Date('2026-09-26T12:00:00Z');
    const row = (title: string, source: string, publishedAt: string) => ({ title, excerpt: '', url: 'https://example.com', source, tier: 'A' as const, publishedAt });
    const picked = pickSmarter([
      row('Get a 100% bonus when you buy Hilton Honors points', 'The Points Guy', '2026-09-25T10:00:00Z'),
      row('Check your Amex account for referral bonuses of 45K points', 'The Points Guy', '2026-09-25T09:00:00Z'),
      row('How much are 100,000 Amex points worth in 2026?', 'Frequent Miler', '2026-09-24T09:00:00Z'),
      row('Old news about Chase Sapphire points bonus', 'Frequent Miler', '2026-09-01T09:00:00Z'),
    ], now);
    expect(picked.map((story) => story.source)).toEqual(['The Points Guy', 'Frequent Miler']);
  });
});

describe('who we read for what', () => {
  it('lifestyle sites only count for gear', () => {
    expect(laneFor('Vacheron Constantin’s $219K Overseas Perpetual Calendar is Just 8.1mm Thick', '', 'Man of Many')).toBeNull();
    expect(laneFor('Sonos Ace Ultra Headphones Review: An Exercise in Fulfilled Promise', '', 'Man of Many')).toBe('gear');
  });
  it('luxury magazines count for stays, not deals', () => {
    expect(laneFor('Marriott Just Reopened This Barbados All-Inclusive Resort, After a Major Transformation', '', 'Caribbean Journal')).toBe('stays');
    expect(laneFor('Uptown Charlotte to welcome W Hotels opening', '', 'Sleeper Magazine')).toBe('stays');
    expect(laneFor('Brooklinen Discount Codes for September 2026', '', 'Condé Nast Traveler')).toBeNull();
  });
  it('unknown publishers are left out', () => {
    expect(laneFor('The best carry-on luggage for a week in Europe', '', 'Some Blog')).toBeNull();
  });
});

describe('hostels and backpacking', () => {
  it('backpacker reading lands in its own lane', () => {
    expect(laneFor('A Guide to the Best Backpacker Hubs in the Mediterranean')).toBe('hostels');
    expect(laneFor('Solo travel in Vietnam on a budget: two weeks')).toBe('hostels');
  });
  it('hostel publishers default to it, but their deals are still deals', () => {
    expect(laneFor('Seven Days in Lisbon: A Complete Itinerary', '', 'Indie Traveller')).toBe('hostels');
    expect(laneFor('Cheapest flights to Bangkok this winter', '', 'Stoked to Travel')).toBe('deals');
  });
});

describe('deals are deals', () => {
  it.each([
    ['Apple Agrees to $250 Million Siri Apple Intelligence Settlement', 'Miles to Memories'],
    ['Boeing 737 MAX 10 Certification Just Days Away, And It’s A Big Deal For Airlines', 'One Mile at a Time'],
  ])('%s is not a deal', (title, source) => {
    expect(laneFor(title, '', source)).not.toBe('deals');
  });
  it('a branding deal in the excerpt does not make a hotel story a deal', () => {
    expect(laneFor('Do you know Marriott has guaranteed compensation amounts for benefit failures?', 'When a hotel owner makes a branding deal with a major hotel chain', 'Head for Points')).not.toBe('deals');
  });
  it.each([
    ['Non-stop flights from Chicago to Frankfurt for $476'],
    ['Scandinavian Airlines: San Francisco – Stavanger, Norway. $594 (Basic Economy) / $694 (Regular Economy). Roundtrip, including all Taxes'],
    ['Cheapest Vacation Package to Las Vegas We’ve Seen'],
  ])('%s is a deal', (title) => {
    expect(laneFor(title, '', 'Fly4free')).toBe('deals');
  });
});

describe('US readers only', () => {
  it('drops a Singapore card from a Singapore blog', () => {
    expect(laneFor(
      'Trust Freedom Card 100,000 miles sign-up bonus: What counts as qualifying spend?',
      "With 100,000 miles on the line, there's no room for error with qualifying spend.",
      'The MileLion',
    )).toBeNull();
  });
  it('drops points and deals from blogs written for other countries, but keeps their lounges and hotels', () => {
    expect(laneFor('Check your Amex account for referral bonuses of 45K points', '', 'Head for Points')).toBeNull();
    expect(laneFor('How much are 100,000 Amex points worth in 2026?', '', 'Point Hacks')).toBeNull();
    expect(laneFor('Bits: Aspire launches 300-seat Manchester lounge, new routes', '', 'Head for Points')).toBe('lounges');
  });
  it('drops fares and offers priced in another currency, from any publisher', () => {
    expect(laneFor('PEAK SEASON Qatar Airways flights from London to the Seychelles from £577')).toBeNull();
    expect(laneFor('Non-stop flights from Frankfurt to Toronto for €476', '', 'Fly4free')).toBeNull();
    expect(laneFor('Earn 60,000 miles with the DBS Altitude card', '', 'One Mile at a Time')).toBeNull();
    expect(laneFor('New card offer: earn bonus points on S$3,000 spend')).toBeNull();
  });
  it('keeps US offers, US dollar prices and programs US cards transfer to', () => {
    expect(laneFor('Chase Sapphire Preferred: 100,000 points welcome offer is back', '', 'The Points Guy')).toBe('points');
    expect(laneFor('Flights to Tokyo from US$599 roundtrip', '', 'The Flight Deal')).toBe('deals');
    expect(laneFor('Book Qatar Qsuites with Avios transferred from Amex', '', 'Frequent Miler')).toBe('points');
    expect(laneFor('A £450 a night London hotel opening worth the trip', '', 'Travel + Leisure')).toBe('stays');
  });
});
