'use client';

import { create } from 'zustand';
import type { GeoPoint } from '@/lib/types';

export type GlobeQuality = 'high' | 'balanced' | 'economy';

interface FlightRequest {
  target: GeoPoint;
  /** Camera distance in globe radii. 1.0 sits on the surface. */
  distance: number;
  /** Route flights move with the on-globe jet; regular camera moves stay brisk. */
  journey: boolean;
  /** An explicit start point takes a short camera alignment before departure. */
  origin: GeoPoint | null;
  /** Monotonic counter so repeat requests to the same point still fire */
  nonce: number;
}

export interface GlobeJourney {
  /** Null means the present globe viewpoint, never an inferred viewer location. */
  origin: GeoPoint | null;
  target: GeoPoint;
  nonce: number;
}

interface GlobeState {
  /** Event the user has committed attention to — opens the dossier */
  selectedEventId: string | null;
  /** Event under the cursor — drives the hover readout, never the dossier */
  hoveredEventId: string | null;
  /** Pending camera move, consumed by the globe's flight controller */
  flight: FlightRequest | null;
  /** Ephemeral route drawn on the globe until the next camera destination. */
  journey: GlobeJourney | null;
  /** Kept after a flight is consumed so repeated card clicks replay. */
  flightSerial: number;
  autoRotate: boolean;
  /** True once the globe has finished its opening move and geometry is up */
  ready: boolean;
  quality: GlobeQuality;
  /** Draw country fills as well as outlines */
  showLandmass: boolean;
  showGraticule: boolean;

  select: (id: string | null) => void;
  hover: (id: string | null) => void;
  flyTo: (target: GeoPoint, distance?: number) => void;
  /** Animate a route from a known location or, if null, the current globe view. */
  travelTo: (target: GeoPoint, origin?: GeoPoint | null, distance?: number) => void;
  consumeFlight: () => void;
  setAutoRotate: (v: boolean) => void;
  setReady: (v: boolean) => void;
  setQuality: (q: GlobeQuality) => void;
  toggleLandmass: () => void;
  toggleGraticule: () => void;
}

export const useGlobeStore = create<GlobeState>((set, get) => ({
  selectedEventId: null,
  hoveredEventId: null,
  flight: null,
  journey: null,
  flightSerial: 0,
  autoRotate: true,
  ready: false,
  quality: 'high',
  showLandmass: true,
  showGraticule: true,

  select: (id) => set({ selectedEventId: id, autoRotate: id ? false : get().autoRotate }),
  hover: (id) => set({ hoveredEventId: id }),
  // The 2.45 view intentionally crops the polar thirds in the bounded stage.
  flyTo: (target, distance = 2.45) =>
    set((s) => ({
      flight: { target, distance, journey: false, origin: null, nonce: s.flightSerial + 1 },
      flightSerial: s.flightSerial + 1,
      journey: null,
      autoRotate: false,
    })),
  travelTo: (target, origin = null, distance = 2.45) =>
    set((s) => ({
      flight: { target, distance, journey: true, origin, nonce: s.flightSerial + 1 },
      journey: { origin, target, nonce: s.flightSerial + 1 },
      flightSerial: s.flightSerial + 1,
      autoRotate: false,
    })),
  consumeFlight: () => set({ flight: null }),
  setAutoRotate: (autoRotate) => set({ autoRotate }),
  setReady: (ready) => set({ ready }),
  setQuality: (quality) => set({ quality }),
  toggleLandmass: () => set((s) => ({ showLandmass: !s.showLandmass })),
  toggleGraticule: () => set((s) => ({ showGraticule: !s.showGraticule })),
}));
