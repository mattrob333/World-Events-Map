import 'server-only';
import { venueCandidates } from './service';
import { PULSE_RADIUS_METERS, roundForSearch, toPulseVenues, type PulseResult, type PulseWhat } from './pulse';

/** One BestTime venue lookup (cached five minutes per ~110 m cell by the NOW service), busiest first. No AI judgment. */
export async function executePulse(point: { lat: number; lng: number }, what: PulseWhat = 'surprise', radiusMeters = PULSE_RADIUS_METERS): Promise<PulseResult> {
  const center = roundForSearch(point);
  const venues = await venueCandidates({ location: center, radiusMeters, intent: what, limit: 50 });
  return { venues: toPulseVenues(venues), source: 'besttime', generatedAt: new Date().toISOString(), center };
}
