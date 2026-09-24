'use client';

import { memo, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { GeoPoint } from '@/lib/types';
import { latLonToVec3 } from '@/lib/geo/projection';

export interface ViewerMarkerInfo {
  /** Must come from a chosen city or granted browser position, never a time zone. */
  coords: GeoPoint;
  /** Short display name, such as ATLANTA or NEARBY. */
  label: string;
}

function labelTexture(label: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 144;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = 'rgba(8, 27, 34, 0.94)';
    context.beginPath();
    context.roundRect(3, 3, 634, 138, 25);
    context.fill();
    context.strokeStyle = 'rgba(131, 226, 212, 0.88)';
    context.lineWidth = 3;
    context.stroke();

    context.fillStyle = '#83e2d4';
    context.beginPath();
    context.arc(39, 72, 10, 0, Math.PI * 2);
    context.fill();
    context.font = '700 43px Arial, sans-serif';
    context.textBaseline = 'middle';
    context.letterSpacing = '3px';
    context.fillStyle = '#e7fff9';
    context.fillText(`YOU / ${label.toUpperCase()}`, 69, 75, 540);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

function ViewerMarkerImpl({ coords, label }: ViewerMarkerInfo) {
  const camera = useThree((state) => state.camera);
  const group = useRef<THREE.Group>(null);
  const reticle = useRef<THREE.Group>(null);
  const sprite = useRef<THREE.Sprite>(null);
  const point = useMemo(() => latLonToVec3(coords.lat, coords.lon), [coords.lat, coords.lon]);
  const pose = useMemo(() => {
    const north = latLonToVec3(Math.min(coords.lat + 0.1, 90), coords.lon)
      .sub(point).normalize();
    const east = latLonToVec3(coords.lat, coords.lon + 0.1)
      .sub(point).normalize();
    return {
      quaternion: new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1), point.clone().normalize(),
      ),
      markerPosition: point.clone().multiplyScalar(1.018),
      labelPosition: point.clone().multiplyScalar(1.145)
        .addScaledVector(north, 0.080)
        .addScaledVector(east, 0.14),
    };
  }, [coords.lat, coords.lon, point]);
  const texture = useMemo(() => labelTexture(label), [label]);
  useEffect(() => () => texture.dispose(), [texture]);

  useFrame(() => {
    if (group.current) {
      // A surface point is visible only when camera·normal > globe radius².
      // Hide the DOM-like sprite at the limb too; depth testing alone would let
      // its elevated label peek out from the back of the planet.
      group.current.visible = point.dot(camera.position) > 1.045;
    }
    // Counter the perspective growth near the minimum zoom. A marker should
    // stay readable instead of becoming a giant overlay when the map is close.
    const reticleScale = THREE.MathUtils.clamp(camera.position.distanceTo(point) / 1.45, 0.38, 1.5);
    if (reticle.current) reticle.current.scale.setScalar(reticleScale);
    if (sprite.current) {
      const labelScale = THREE.MathUtils.clamp(
        camera.position.distanceTo(pose.labelPosition) / 1.30,
        0.34,
        1.5,
      );
      sprite.current.scale.set(0.25 * labelScale, 0.05625 * labelScale, 1);
    }
  });

  return (
    <group ref={group}>
      <group ref={reticle} position={pose.markerPosition} quaternion={pose.quaternion}>
        <mesh renderOrder={14}>
          <sphereGeometry args={[0.014, 16, 12]} />
          <meshBasicMaterial color="#d1fff7" toneMapped={false} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0, 0.004]} renderOrder={13}>
          <torusGeometry args={[0.036, 0.0032, 8, 40]} />
          <meshBasicMaterial color="#83e2d4" toneMapped={false} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0, 0.003]} renderOrder={12}>
          <ringGeometry args={[0.046, 0.051, 40]} />
          <meshBasicMaterial color="#83e2d4" side={THREE.DoubleSide} transparent opacity={0.38} toneMapped={false} depthWrite={false} />
        </mesh>
        <mesh position={[0, 0, 0.045]} rotation={[Math.PI / 2, 0, 0]} renderOrder={13}>
          <cylinderGeometry args={[0.0016, 0.004, 0.09, 8]} />
          <meshBasicMaterial color="#83e2d4" transparent opacity={0.72} toneMapped={false} depthWrite={false} />
        </mesh>
      </group>
      <sprite ref={sprite} position={pose.labelPosition} scale={[0.25, 0.05625, 1]} renderOrder={15}>
        <spriteMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
      </sprite>
    </group>
  );
}

export const ViewerMarker = memo(ViewerMarkerImpl);
