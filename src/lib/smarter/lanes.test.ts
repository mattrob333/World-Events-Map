import { describe, expect, it } from 'vitest';
import { laneFor, pickSmarter } from './lanes';

describe('travel smarter lanes', () => {
  it.each([
    ['Which Airport Lounges Offer Complimentary Spa Treatments?', 'lounges'],
    ['LAST DAY: Get a 100% bonus when you buy Hilton Honors hotel points', 'points'],
    ['PEAK SEASON Qatar Airways flights from London to the Seychelles from £577', 'deals'],
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
      row('Get a 100% bonus when you buy Hilton Honors points', 'Head for Points', '2026-09-25T10:00:00Z'),
      row('Check your Amex account for referral bonuses of 45K points', 'Head for Points', '2026-09-25T09:00:00Z'),
      row('How much are 100,000 Amex points worth in 2026?', 'Point Hacks', '2026-09-24T09:00:00Z'),
      row('Old news about Chase Sapphire points bonus', 'Frequent Miler', '2026-09-01T09:00:00Z'),
    ], now);
    expect(picked.map((story) => story.source)).toEqual(['Head for Points', 'Point Hacks']);
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
