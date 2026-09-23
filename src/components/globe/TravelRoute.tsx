'use client';

import { memo, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { GlobeJourney } from '@/lib/stores/useGlobeStore';
import { useGlobeStore } from '@/lib/stores/useGlobeStore';
import {
  angularDistanceRad,
  greatCirclePoints,
  latLonToVec3,
  vec3ToLatLon,
} from '@/lib/geo/projection';
import { JOURNEY_ALIGN_MS, JOURNEY_TRAVEL_MS } from '@/lib/geo/camera';
import { useReducedMotion } from './useReducedMotion';

const TUBULAR_SEGMENTS = 144;
const RADIAL_SEGMENTS = 6;
const JOURNEY_GOLD = '#ffe1a8';
const ORIGIN_TEAL = '#83e2d4';

function easeJourney(t: number): number {
  return t * t * (3 - 2 * t);
}

function makeJetShape(): THREE.ShapeGeometry {
  // A compact aircraft silhouette, drawn in the local tangent plane. +X is
  // forward, +Y is the wing axis and +Z points away from the planet.
  const outline = new THREE.Shape();
  outline.moveTo(0.047, 0);
  outline.lineTo(0.004, 0.006);
  outline.lineTo(-0.010, 0.034);
  outline.lineTo(-0.020, 0.034);
  outline.lineTo(-0.012, 0.006);
  outline.lineTo(-0.037, 0.014);
  outline.lineTo(-0.043, 0.009);
  outline.lineTo(-0.031, 0);
  outline.lineTo(-0.043, -0.009);
  outline.lineTo(-0.037, -0.014);
  outline.lineTo(-0.012, -0.006);
  outline.lineTo(-0.020, -0.034);
  outline.lineTo(-0.010, -0.034);
  outline.lineTo(0.004, -0.006);
  outline.closePath();
  return new THREE.ShapeGeometry(outline);
}

function RouteMarker({
  point,
  color,
  destination = false,
}: {
  point: THREE.Vector3;
  color: string;
  destination?: boolean;
}) {
  const pose = useMemo(() => ({
    position: point.clone().multiplyScalar(1.018),
    quaternion: new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1), point.clone().normalize(),
    ),
  }), [point]);

  return (
    <group position={pose.position} quaternion={pose.quaternion}>
      <mesh renderOrder={11}>
        <sphereGeometry args={[destination ? 0.012 : 0.010, 12, 8]} />
        <meshBasicMaterial color={color} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh renderOrder={11} position={[0, 0, 0.003]}>
        <torusGeometry args={[destination ? 0.029 : 0.023, 0.0026, 6, 32]} />
        <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.95} depthWrite={false} />
      </mesh>
      {destination && (
        <mesh renderOrder={10} position={[0, 0, -0.002]}>
          <ringGeometry args={[0.034, 0.041, 40]} />
          <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.26} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

function ActiveTravelRoute({ journey }: { journey: GlobeJourney }) {
  const camera = useThree((state) => state.camera);
  const reducedMotion = useReducedMotion();
  const jet = useRef<THREE.Group>(null);
  const startTime = useRef<number | null>(null);

  const route = useMemo(() => {
    const origin = journey.origin ?? vec3ToLatLon(camera.position);
    const originPoint = latLonToVec3(origin.lat, origin.lon);
    const destinationPoint = latLonToVec3(journey.target.lat, journey.target.lon);
    const angle = angularDistanceRad(origin, journey.target);
    if (angle < 0.006) {
      return { originPoint, destinationPoint, curve: null, guide: null, glow: null, trail: null };
    }

    const lift = THREE.MathUtils.clamp(0.075 + angle * 0.05, 0.09, 0.22);
    const points = greatCirclePoints(origin, journey.target, 96, lift);
    const bowAxis = originPoint.clone().cross(destinationPoint);
    if (bowAxis.lengthSq() > 1e-6) {
      bowAxis.normalize();
      if (bowAxis.y < 0) bowAxis.negate();
      // The route's great-circle base rises off the sphere; a gentle sideways
      // bow makes that height legible from the camera's near-overhead view.
      points.forEach((point, index) => {
        point.addScaledVector(bowAxis, 0.10 * Math.sin(Math.PI * index / (points.length - 1)));
      });
    }
    const curve = new THREE.CatmullRomCurve3(points);
    const guide = new THREE.TubeGeometry(curve, TUBULAR_SEGMENTS, 0.0028, RADIAL_SEGMENTS, false);
    const glow = new THREE.TubeGeometry(curve, TUBULAR_SEGMENTS, 0.011, RADIAL_SEGMENTS, false);
    const trail = new THREE.TubeGeometry(curve, TUBULAR_SEGMENTS, 0.0048, RADIAL_SEGMENTS, false);
    trail.setDrawRange(0, 0);
    glow.setDrawRange(0, 0);
    return { originPoint, destinationPoint, curve, guide, glow, trail };
  }, [camera, journey]);

  const jetGeometry = useMemo(() => makeJetShape(), []);
  useEffect(() => () => {
    route.guide?.dispose();
    route.glow?.dispose();
    route.trail?.dispose();
    jetGeometry.dispose();
  }, [route, jetGeometry]);

  const orientation = useMemo(() => ({
    tangent: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    wing: new THREE.Vector3(),
    matrix: new THREE.Matrix4(),
  }), []);

  useFrame(() => {
    if (!route.curve || !route.trail || !route.glow) return;
    if (startTime.current === null) startTime.current = performance.now();
    const elapsed = performance.now() - startTime.current;
    const delay = journey.origin ? JOURNEY_ALIGN_MS : 0;
    const linear = THREE.MathUtils.clamp((elapsed - delay) / JOURNEY_TRAVEL_MS, 0, 1);
    const progress = reducedMotion ? 1 : easeJourney(linear);
    const indexCount = route.trail.getIndex()?.count ?? 0;
    const drawCount = Math.min(indexCount, Math.floor(progress * TUBULAR_SEGMENTS) * RADIAL_SEGMENTS * 6);
    route.trail.setDrawRange(0, drawCount);
    route.glow.setDrawRange(0, drawCount);

    if (!jet.current) return;
    jet.current.visible = !reducedMotion && linear < 1 && elapsed >= delay;
    if (!jet.current.visible) return;
    route.curve.getPointAt(progress, jet.current.position);
    route.curve.getTangentAt(progress, orientation.tangent).normalize();
    orientation.normal.copy(jet.current.position).normalize();
    orientation.wing.crossVectors(orientation.normal, orientation.tangent).normalize();
    orientation.tangent.crossVectors(orientation.wing, orientation.normal).normalize();
    orientation.matrix.makeBasis(orientation.tangent, orientation.wing, orientation.normal);
    jet.current.quaternion.setFromRotationMatrix(orientation.matrix);
  });

  return (
    <group>
      {route.guide && route.glow && route.trail && (
        <>
          <mesh geometry={route.guide} renderOrder={7}>
            <meshBasicMaterial color="#79afc1" transparent opacity={0.3} toneMapped={false} depthWrite={false} />
          </mesh>
          <mesh geometry={route.glow} renderOrder={8}>
            <meshBasicMaterial color={JOURNEY_GOLD} transparent opacity={0.19} blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
          </mesh>
          <mesh geometry={route.trail} renderOrder={9}>
            <meshBasicMaterial color={JOURNEY_GOLD} transparent opacity={0.97} blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
          </mesh>
          <group ref={jet} renderOrder={12}>
            <mesh geometry={jetGeometry}>
              <meshBasicMaterial color="#fff4dc" side={THREE.DoubleSide} toneMapped={false} depthWrite={false} />
            </mesh>
            <mesh position={[-0.004, 0, -0.007]}>
              <sphereGeometry args={[0.012, 8, 6]} />
              <meshBasicMaterial color={JOURNEY_GOLD} transparent opacity={0.6} blending={THREE.AdditiveBlending} toneMapped={false} depthWrite={false} />
            </mesh>
          </group>
        </>
      )}
      <RouteMarker point={route.originPoint} color={journey.origin ? ORIGIN_TEAL : '#8ebfd8'} />
      <RouteMarker point={route.destinationPoint} color={JOURNEY_GOLD} destination />
    </group>
  );
}

function TravelRouteImpl() {
  const journey = useGlobeStore((state) => state.journey);
  if (!journey) return null;
  return <ActiveTravelRoute key={journey.nonce} journey={journey} />;
}

export const TravelRoute = memo(TravelRouteImpl);
