import type { TripType } from '@/lib/jev/contracts/feedItem';

/** Kinds of trip from plain words. Shared by the server router and the stage's recap. */
const TYPE_WORDS: [TripType, RegExp][] = [
  ['ski', /\b(ski|skiing|snowboard|powder|slopes?)\b/i], ['surf', /\b(surf|surfing|waves?)\b/i], ['beach', /\b(beach(?:es)?|island|sun|sunny|warm|tropical|heat)\b/i],
  ['food', /\b(food|eat|restaurants?|foodie)\b/i], ['nightlife', /\b(nightlife|clubs?|bars?|party)\b/i], ['festivals', /\bfestivals?\b/i],
  ['music', /\b(concerts?|gigs?|live music)\b/i], ['sports', /\b(race|match|game|golf|tennis|f1|formula)\b/i], ['culture', /\b(museums?|art|history|culture)\b/i],
  ['adventure', /\b(safari|adventure|hike|trek)\b/i], ['wellness', /\b(spa|retreat|wellness)\b/i], ['family', /\b(kids|family)\b/i],
];

export function tripTypeFromText(text: string): TripType | null {
  return TYPE_WORDS.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}

