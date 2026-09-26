import type { NowIntent, NowRequest, NowVibe } from './types';

type UnknownRecord = Record<string, unknown>;

const INTENTS = new Set<NowIntent>(['food', 'drinks', 'music', 'experience', 'surprise']);
const VIBES = new Set<NowVibe>(['chill', 'social', 'lively', 'surprise']);

function record(value: unknown): UnknownRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

function finite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function optionalNumber(
  value: unknown,
  label: string,
  min: number,
  max: number,
): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = finite(value);
  if (parsed === undefined || parsed < min || parsed > max) {
    throw new Error(`${label} must be between ${min} and ${max}.`);
  }
  return parsed;
}

export function validateNowRequest(input: unknown): NowRequest {
  const body = record(input);
  if (!body) throw new Error('Request body must be an object.');
  const location = record(body.location);
  const lat = finite(location?.lat);
  const lng = finite(location?.lng);
  if (lat === undefined || lat < -90 || lat > 90) {
    throw new Error('Latitude must be between -90 and 90.');
  }
  if (lng === undefined || lng < -180 || lng > 180) {
    throw new Error('Longitude must be between -180 and 180.');
  }

  if (typeof body.intent !== 'string' || !INTENTS.has(body.intent as NowIntent)) {
    throw new Error('Choose a valid NOW intent.');
  }
  if (typeof body.vibe !== 'string' || !VIBES.has(body.vibe as NowVibe)) {
    throw new Error('Choose a valid NOW vibe.');
  }

  const radiusMeters = finite(body.radiusMeters);
  if (radiusMeters === undefined || radiusMeters < 250 || radiusMeters > 25_000) {
    throw new Error('Search radius must be between 250 and 25000 meters.');
  }

  const interests = Array.isArray(body.interests)
    ? [...new Set(
        body.interests
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter(Boolean),
      )].slice(0, 12)
    : undefined;
  if (interests?.some((item) => item.length > 80)) {
    throw new Error('Each interest must be 80 characters or fewer.');
  }

  const travelModeName = typeof body.travelModeName === 'string'
    ? body.travelModeName.trim().slice(0, 80)
    : undefined;

  return {
    // Rounded to about a kilometer before anything reaches a provider or a cache key.
    location: { lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100 },
    intent: body.intent as NowIntent,
    vibe: body.vibe as NowVibe,
    radiusMeters: Math.round(radiusMeters),
    availableMinutes: optionalNumber(body.availableMinutes, 'Available time', 30, 1440),
    maxPriceLevel: optionalNumber(body.maxPriceLevel, 'Maximum price level', 1, 5),
    minRating: optionalNumber(body.minRating, 'Minimum rating', 1, 5),
    partySize: optionalNumber(body.partySize, 'Party size', 1, 20),
    interests,
    travelModeName,
  };
}
