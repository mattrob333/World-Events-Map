import type { GeoPoint } from '@/lib/types';
import { greatCircleDistanceKm } from '@/lib/geo/projection';

export interface RouteEstimate {
  /** Great-circle distance, rounded for a city-level display. */
  distanceKm: number;
  /** Indicative nonstop air travel in hours. No flight schedule is consulted. */
  airHours: number;
  label: string;
}

/**
 * A deliberately coarse preview for the globe story. Real routes, transfers,
 * airport time, and ground transport are unknown until a trip is planned.
 */
export function estimateRoute(origin: GeoPoint, target: GeoPoint): RouteEstimate {
  const distanceKm = Math.round(greatCircleDistanceKm(origin, target) / 10) * 10;
  if (distanceKm < 50) {
    return { distanceKm, airHours: 0, label: 'Already in the area' };
  }

  // A broad cruise speed plus a small allowance for climb and descent.
  const airHours = Math.max(0.75, Math.round((distanceKm / 800 + 0.45) * 4) / 4);
  const hours = Math.floor(airHours);
  const minutes = Math.round((airHours - hours) * 60);
  const duration = hours ? `${hours}h${minutes ? ` ${minutes}m` : ''}` : `${minutes}m`;
  return { distanceKm, airHours, label: `~${duration} in the air` };
}
