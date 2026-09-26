'use client';

import { memo, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Beacon, GeoPoint } from '@/lib/types';
import { angularDistanceRad, greatCirclePoints } from '@/lib/geo/projection';
import { useGlobeStore } from '@/lib/stores/useGlobeStore';
import { hash01 } from './beaconState';
import { pickReach } from './reach';
import { useReducedMotion } from './useReducedMotion';

const SEGMENTS = 96;

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// A faint standing arc, and a glow that travels out from the viewer along it.
const FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uPhase;
uniform float uMotion;
uniform vec3 uColor;
uniform float uStrength;
varying vec2 vUv;
void main() {
  float along = vUv.x;
  float ends = smoothstep(0.0, 0.06, along) * smoothstep(1.0, 0.94, along);
  float head = fract(uTime * 0.16 + uPhase);
  float d = along - head;
  float pulse = exp(-(d * d) / 0.0018) * uMotion;
  float trail = d < 0.0 ? exp(d / 0.12) * 0.35 * uMotion : 0.0;
  float a = (0.16 + pulse + trail) * ends * uStrength;
  gl_FragColor = vec4(uColor * (1.0 + pulse), a);
}
`;

type Arc = { id: string; geometry: THREE.TubeGeometry; material: THREE.ShaderMaterial };

/**
 * "See how far a single place can take you": soft arcs from where the viewer
 * is to what's live now and what's strongest on the calendar, a glow running
 * out along each. Hidden while a journey flight is on screen.
 */
function ReachArcsImpl({ beacons, origin }: { beacons: readonly Beacon[]; origin: GeoPoint }) {
  const journey = useGlobeStore((state) => state.journey);
  const reducedMotion = useReducedMotion();
  const targets = useMemo(() => pickReach(beacons, origin, 5), [beacons, origin]);
  // Rebuild only when where they are or the destinations change, not on every beacon update.
  const key = `${origin.lat.toFixed(3)},${origin.lon.toFixed(3)}>${targets.map((beacon) => `${beacon.eventId}${beacon.live ? '*' : ''}`).join('|')}`;

  const arcs = useMemo<Arc[]>(() => targets.map((beacon) => {
    const angle = angularDistanceRad(origin, beacon.coords);
    const lift = THREE.MathUtils.clamp(0.05 + angle * 0.045, 0.06, 0.2);
    const curve = new THREE.CatmullRomCurve3(greatCirclePoints(origin, beacon.coords, 72, lift));
    const geometry = new THREE.TubeGeometry(curve, SEGMENTS, 0.0032, 5, false);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPhase: { value: hash01(beacon.eventId) },
        uMotion: { value: 1 },
        uColor: { value: new THREE.Color(beacon.live ? '#f7c548' : '#ffe1a8') },
        uStrength: { value: beacon.live ? 1 : 0.7 },
      },
    });
    return { id: beacon.eventId, geometry, material };
  }), [key]); // eslint-disable-line react-hooks/exhaustive-deps -- `key` names the origin and targets used

  useEffect(() => () => arcs.forEach((arc) => { arc.geometry.dispose(); arc.material.dispose(); }), [arcs]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    for (const arc of arcs) {
      arc.material.uniforms.uTime.value = t;
      arc.material.uniforms.uMotion.value = reducedMotion ? 0 : 1;
    }
  });

  if (journey) return null;
  return (
    <group>
      {arcs.map((arc) => (
        <mesh key={arc.id} geometry={arc.geometry} material={arc.material} renderOrder={6} />
      ))}
    </group>
  );
}

export const ReachArcs = memo(ReachArcsImpl);
