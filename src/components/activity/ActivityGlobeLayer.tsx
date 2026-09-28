'use client';

import { useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import type { Activity } from '@/lib/activity/activities';
import { GLOBE_RADIUS, latLonToVec3 } from '@/lib/geo/projection';
import { useGlobeStore } from '@/lib/stores/useGlobeStore';
import { MIN_DISTANCE } from '@/components/globe/CameraRig';
import ActivityLayer, { type FlyOptions } from './ActivityLayer';

/** How close a spot flight lands, in globe radii: near enough to read the region, far enough to keep context. */
const SPOT_DISTANCE = 1.8;
/** Longest we wait on the camera before opening the card anyway. */
const FLIGHT_TIMEOUT_MS = 2500;

/**
 * Resolves when the camera rig reports its next settle (a flight landed, a
 * reduced-motion cut, or a gesture that took over), or after a timeout.
 */
function waitForSettle(from: number): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      unsubscribe();
      window.clearTimeout(timer);
      resolve();
    };
    const unsubscribe = useGlobeStore.subscribe((s) => {
      if (s.settledSerial !== from) finish();
    });
    const timer = window.setTimeout(finish, FLIGHT_TIMEOUT_MS);
  });
}

/**
 * The activity markers, clusters and labels, drawn inside the existing globe
 * canvas. This adapter speaks the globe's language: its projection, its radius
 * and its camera flights.
 */
export function ActivityGlobeLayer({ activities, maxLabels, topInset, onSelect }: {
  activities: Activity[];
  maxLabels: number;
  topInset: number;
  onSelect: (id: string | null) => void;
}) {
  const camera = useThree((s) => s.camera);

  const latLngToVector3 = useCallback(
    (lat: number, lng: number, altitude: number): THREE.Vector3 => latLonToVec3(lat, lng, GLOBE_RADIUS * (1 + altitude)),
    [],
  );

  const flyTo = useCallback((lat: number, lng: number, opts?: FlyOptions) => {
    const current = camera.position.length() / GLOBE_RADIUS;
    // A spot never pulls the camera back out; a cluster always moves it closer.
    const distance = opts?.zoom === 'cluster'
      ? Math.max(MIN_DISTANCE, current * 0.62)
      : Math.max(MIN_DISTANCE, Math.min(current, SPOT_DISTANCE));
    const store = useGlobeStore.getState();
    const settled = waitForSettle(store.settledSerial);
    store.flyTo({ lat, lon: lng }, distance);
    return settled;
  }, [camera]);

  return (
    <ActivityLayer
      activities={activities}
      latLngToVector3={latLngToVector3}
      flyTo={flyTo}
      onSelect={onSelect}
      maxLabels={maxLabels}
      topInset={topInset}
    />
  );
}
