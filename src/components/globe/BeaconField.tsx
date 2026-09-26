'use client';

/**
 * The beacon field — precise points of light on an obsidian planet.
 *
 * Five instanced meshes, five draw calls, regardless of how many beacons there
 * are. Nothing is a React component per beacon; nothing allocates a material
 * per beacon. At 250 beacons the per-frame cost is at most 1250 matrix
 * composes and five small buffer uploads.
 *
 *   pillars  — short stems along the local normal, fading out toward the top.
 *   discs    — a crisp point with a soft, small halo on the surface.
 *   rings    — restrained pulse rings, blazing/supernova only, phase-staggered
 *              from a hash of the event id; saffron rings on anything live now.
 *   focus    — a locked brass reticle around the selected event.
 *   crystal  — a six-armed ice mark for curated ski events in winter mode.
 *
 * Occlusion: everything depth-tests against the ocean sphere, so a beacon on
 * the far side is simply behind the planet. The flat surface decals (discs,
 * rings, reticle) additionally fade out across the true horizon in the vertex
 * shader — depth alone would let a disc at the limb peek round the edge.
 */

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Beacon } from '@/lib/types';
import { GLOBE_RADIUS } from '@/lib/geo/projection';
import { HORIZON_GLSL, OUTPUT_GLSL } from './shaderLib';
import { useReducedMotion } from './useReducedMotion';
import { BeaconPicker } from './BeaconPicker';
import {
  BeaconRegistry,
  beaconIntensity,
  discRadius,
  focusRadius,
  pillarHeight,
  pillarRadius,
  ringRadius,
  type BeaconEntry,
} from './beaconState';

const R = GLOBE_RADIUS;

/** Surface offsets. Ordered so nothing z-fights with the lines at 0.0032. */
const LIFT_PILLAR = 0.0015;
const LIFT_RING = 0.0040;
const LIFT_DISC = 0.0045;
const LIFT_FOCUS = 0.0050;
const LIFT_CRYSTAL = 0.0055;

const UP_Y = new THREE.Vector3(0, 1, 0);
/** The LIVE chip's saffron, as a ring colour. */
const LIVE_RING = new THREE.Color('#f7c548');
const UP_Z = new THREE.Vector3(0, 0, 1);

// ─────────────────────────────────────────────────────────────────────────────
// Shaders
// ─────────────────────────────────────────────────────────────────────────────

const PILLAR_VERTEX = /* glsl */ `
attribute vec3 aColor;
attribute float aIntensity;

varying vec3 vColor;
varying float vIntensity;
varying float vH;

void main() {
  vColor = aColor;
  vIntensity = aIntensity;
  vH = uv.y; // 0 at the base of the cylinder, 1 at the tip

  mat4 im = mat4(1.0);
  #ifdef USE_INSTANCING
    im = instanceMatrix;
  #endif

  vec4 world = modelMatrix * im * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const PILLAR_FRAGMENT = /* glsl */ `
uniform float uGain;

varying vec3 vColor;
varying float vIntensity;
varying float vH;

void main() {
  // Dense at the ground, gone by the top. The shaft should look like it is
  // dissipating into the air, not like a cylinder someone forgot to cap.
  float h = clamp(vH, 0.0, 1.0);
  float fall = pow(1.0 - h, 2.5);
  float core = pow(1.0 - h, 6.0);

  float a = fall * vIntensity * uGain * 0.56;
  vec3 col = vColor * (0.9 + 0.85 * core) * vIntensity;

  gl_FragColor = vec4(col, a);
${OUTPUT_GLSL}
}
`;

/** Shared by every flat surface decal. */
const DECAL_VERTEX = /* glsl */ `
attribute vec3 aColor;
attribute float aIntensity;
attribute float aPhase;

uniform float uGlobeRadius;

varying vec2 vUv;
varying vec3 vColor;
varying float vIntensity;
varying float vPhase;
varying float vFacing;

${HORIZON_GLSL}

void main() {
  vUv = uv;
  vColor = aColor;
  vIntensity = aIntensity;
  vPhase = aPhase;

  mat4 im = mat4(1.0);
  #ifdef USE_INSTANCING
    im = instanceMatrix;
  #endif

  mat4 m = modelMatrix * im;
  vec4 world = m * vec4(position, 1.0);
  vec3 centre = (m * vec4(0.0, 0.0, 0.0, 1.0)).xyz;

  vFacing = horizonVisibility(normalize(centre), cameraPosition, uGlobeRadius, 0.05);

  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const DISC_FRAGMENT = /* glsl */ `
uniform float uGain;

varying vec2 vUv;
varying vec3 vColor;
varying float vIntensity;
varying float vFacing;

void main() {
  float d = length(vUv - 0.5) * 2.0;
  if (d > 1.0) discard;

  float falloff = pow(1.0 - d, 3.8);
  float hotspot = 1.0 - smoothstep(0.12, 0.28, d);

  float a = (falloff * 0.35 + hotspot * 0.95) * vIntensity * vFacing * uGain;
  vec3 col = mix(vColor, vec3(1.0), hotspot * 0.6) * (1.0 + hotspot * 0.6) * vIntensity;

  gl_FragColor = vec4(col, a);
${OUTPUT_GLSL}
}
`;

const RING_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uSpeed;
uniform float uGain;

varying vec2 vUv;
varying vec3 vColor;
varying float vIntensity;
varying float vPhase;
varying float vFacing;

void main() {
  float d = length(vUv - 0.5) * 2.0;
  if (d > 1.0) discard;

  float t = fract(uTime * uSpeed + vPhase);
  float w = 0.055 + 0.025 * t;
  float u = (d - t) / w;
  float a = exp(-u * u) * (1.0 - t) * (1.0 - t);

  a *= vIntensity * vFacing * uGain;
  gl_FragColor = vec4(vColor * 1.25 * vIntensity, a);
${OUTPUT_GLSL}
}
`;

const FOCUS_FRAGMENT = /* glsl */ `
uniform float uGain;

varying vec2 vUv;
varying vec3 vColor;
varying float vIntensity;
varying float vFacing;

void main() {
  vec2 p = vUv - 0.5;
  float d = length(p) * 2.0;
  if (d > 1.0) discard;

  float ang = atan(p.y, p.x);

  // A sustained inner ring — this one does not expand, it holds. That is the
  // whole difference between "this is hot" and "this is the one you picked".
  float ui = (d - 0.62) / 0.028;
  float inner = exp(-ui * ui);

  // Four ticks on an outer arc.
  float ticks = smoothstep(0.82, 0.94, abs(cos(ang * 2.0)));
  float uo = (d - 0.93) / 0.030;
  float outer = exp(-uo * uo) * ticks;

  float a = (inner * 0.85 + outer) * vIntensity * vFacing * uGain;
  gl_FragColor = vec4(vColor * vIntensity * 1.15, a);
${OUTPUT_GLSL}
}
`;

/** Draw the mark procedurally so each ski destination shares one draw call. */
const CRYSTAL_FRAGMENT = /* glsl */ `
uniform float uGain;

varying vec2 vUv;
varying vec3 vColor;
varying float vIntensity;
varying float vFacing;

float segmentDistance(vec2 point, vec2 a, vec2 b) {
  vec2 segment = b - a;
  return length(point - a - segment * clamp(dot(point - a, segment) / dot(segment, segment), 0.0, 1.0));
}

void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float d = length(p);
  if (d > 0.94) discard;

  float crystal = 1.0 - smoothstep(0.055, 0.13, d);
  for (int i = 0; i < 6; i++) {
    float angle = float(i) * 1.04719755;
    vec2 axis = vec2(cos(angle), sin(angle));
    vec2 side = vec2(-axis.y, axis.x);
    crystal = max(crystal, 1.0 - smoothstep(0.018, 0.047,
      segmentDistance(p, axis * 0.10, axis * 0.78)));
    vec2 fork = axis * 0.46;
    crystal = max(crystal, 1.0 - smoothstep(0.012, 0.039,
      segmentDistance(p, fork, axis * 0.61 + side * 0.17)));
    crystal = max(crystal, 1.0 - smoothstep(0.012, 0.039,
      segmentDistance(p, fork, axis * 0.61 - side * 0.17)));
  }

  float halo = pow(max(1.0 - d, 0.0), 5.0) * 0.22;
  float alpha = (crystal * 0.88 + halo) * vIntensity * vFacing * uGain;
  vec3 color = mix(vColor, vec3(1.0), crystal * 0.72);
  gl_FragColor = vec4(color * (0.95 + crystal * 0.35), alpha);
${OUTPUT_GLSL}
}
`;

// ─────────────────────────────────────────────────────────────────────────────

interface InstancedLayer {
  geometry: THREE.BufferGeometry;
  color: THREE.InstancedBufferAttribute;
  intensity: THREE.InstancedBufferAttribute;
  phase: THREE.InstancedBufferAttribute;
}

function makeLayer(base: THREE.BufferGeometry, capacity: number): InstancedLayer {
  const geometry = base.clone();

  const color = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
  const intensity = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
  const phase = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);

  color.setUsage(THREE.DynamicDrawUsage);
  intensity.setUsage(THREE.DynamicDrawUsage);
  phase.setUsage(THREE.DynamicDrawUsage);

  geometry.setAttribute('aColor', color);
  geometry.setAttribute('aIntensity', intensity);
  geometry.setAttribute('aPhase', phase);

  return { geometry, color, intensity, phase };
}

/** Round up to the next power of two, floored at 64. */
function capacityFor(n: number): number {
  if (n <= 64) return 64;
  return 1 << Math.ceil(Math.log2(n));
}

export interface BeaconFieldProps {
  beacons: Beacon[];
  /** A visual cue only; ski category and supplied beacons remain the source of truth. */
  winterMode?: boolean;
}

function BeaconFieldImpl({ beacons, winterMode = false }: BeaconFieldProps) {
  const reducedMotion = useReducedMotion();

  const registry = useMemo(() => new BeaconRegistry(), []);
  // Derived-during-render, deliberately: the registry must see a new beacon
  // array before the frame that draws it, and an effect would be one frame late.
  useMemo(() => registry.sync(beacons), [registry, beacons]);

  const [capacity, setCapacity] = useState(() => capacityFor(beacons.length));
  useEffect(() => {
    const needed = capacityFor(Math.max(beacons.length, registry.size));
    if (needed > capacity) setCapacity(needed);
  }, [beacons.length, capacity, registry]);

  // ── Base geometries ───────────────────────────────────────────────────────
  const bases = useMemo(() => {
    // Tapered, open-ended tube: reads as a shaft of light rather than a rod.
    const pillar = new THREE.CylinderGeometry(0.26, 1, 1, 12, 1, true);
    pillar.translate(0, 0.5, 0);
    const disc = new THREE.CircleGeometry(1, 40);
    return { pillar, disc };
  }, []);

  const layers = useMemo(
    () => ({
      pillar: makeLayer(bases.pillar, capacity),
      disc: makeLayer(bases.disc, capacity),
      ring: makeLayer(bases.disc, capacity),
      focus: makeLayer(bases.disc, 16),
      crystal: makeLayer(bases.disc, capacity),
    }),
    [bases, capacity],
  );

  // ── Materials ─────────────────────────────────────────────────────────────
  const materials = useMemo(() => {
    const common = {
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: true,
    } as const;

    return {
      pillar: new THREE.ShaderMaterial({
        ...common,
        vertexShader: PILLAR_VERTEX,
        fragmentShader: PILLAR_FRAGMENT,
        uniforms: { uGain: { value: 0.85 } },
      }),
      disc: new THREE.ShaderMaterial({
        ...common,
        vertexShader: DECAL_VERTEX,
        fragmentShader: DISC_FRAGMENT,
        uniforms: { uGain: { value: 0.9 }, uGlobeRadius: { value: R } },
      }),
      ring: new THREE.ShaderMaterial({
        ...common,
        vertexShader: DECAL_VERTEX,
        fragmentShader: RING_FRAGMENT,
        uniforms: {
          uGain: { value: 0.38 },
          uGlobeRadius: { value: R },
          uTime: { value: 0 },
          uSpeed: { value: 0.17 },
        },
      }),
      focus: new THREE.ShaderMaterial({
        ...common,
        vertexShader: DECAL_VERTEX,
        fragmentShader: FOCUS_FRAGMENT,
        uniforms: {
          uGain: { value: 1.0 },
          uGlobeRadius: { value: R },
        },
      }),
      crystal: new THREE.ShaderMaterial({
        ...common,
        vertexShader: DECAL_VERTEX,
        fragmentShader: CRYSTAL_FRAGMENT,
        uniforms: { uGain: { value: 1.0 }, uGlobeRadius: { value: R } },
      }),
    };
  }, []);

  useEffect(
    () => () => {
      for (const m of Object.values(materials)) m.dispose();
    },
    [materials],
  );

  useEffect(
    () => () => {
      for (const l of Object.values(layers)) l.geometry.dispose();
    },
    [layers],
  );

  useEffect(
    () => () => {
      bases.pillar.dispose();
      bases.disc.dispose();
    },
    [bases],
  );

  // ── Refs ──────────────────────────────────────────────────────────────────
  const pillarRef = useRef<THREE.InstancedMesh>(null);
  const discRef = useRef<THREE.InstancedMesh>(null);
  const ringRef = useRef<THREE.InstancedMesh>(null);
  const focusRef = useRef<THREE.InstancedMesh>(null);
  const crystalRef = useRef<THREE.InstancedMesh>(null);

  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      position: new THREE.Vector3(),
      quatY: new THREE.Quaternion(),
      quatZ: new THREE.Quaternion(),
      scale: new THREE.Vector3(),
    }),
    [],
  );

  const settled = useRef(false);
  useEffect(() => {
    if (reducedMotion && !settled.current) {
      registry.settle();
      settled.current = true;
    }
  }, [reducedMotion, registry]);

  // ── The loop ──────────────────────────────────────────────────────────────
  useFrame((state, rawDelta) => {
    // A tab that has been backgrounded hands back a huge delta; clamping keeps
    // the damping from overshooting into a visible jump.
    const dt = Math.min(rawDelta, 1 / 20);
    registry.step(dt);

    const t = state.clock.elapsedTime;
    materials.ring.uniforms.uTime.value = t;

    const pillars = pillarRef.current;
    const discs = discRef.current;
    const rings = ringRef.current;
    const focus = focusRef.current;
    const crystals = crystalRef.current;
    if (!pillars || !discs || !rings || !focus || !crystals) return;

    const { matrix, position, quatY, quatZ, scale } = scratch;
    const order = registry.order;

    let nPillar = 0;
    let nDisc = 0;
    let nRing = 0;
    let nFocus = 0;
    let nCrystal = 0;

    const cap = capacity;

    for (let i = 0; i < order.length; i++) {
      const e = order[i];
      if (e.presence <= 0.002) continue;

      const intensity = beaconIntensity(e);
      if (intensity <= 0.0015) continue;

      const n = e.normal;
      quatY.setFromUnitVectors(UP_Y, n);
      quatZ.setFromUnitVectors(UP_Z, n);

      // ── Pillar ──
      if (nPillar < cap) {
        const rad = pillarRadius(e);
        const h = pillarHeight(e);
        position.copy(n).multiplyScalar(R + LIFT_PILLAR);
        scale.set(rad, Math.max(h, 1e-4), rad);
        matrix.compose(position, quatY, scale);
        pillars.setMatrixAt(nPillar, matrix);
        writeInstance(layers.pillar, nPillar, e, intensity);
        nPillar++;
      }

      // ── Ground disc ──
      if (nDisc < cap) {
        const dr = discRadius(e);
        position.copy(n).multiplyScalar(R + LIFT_DISC);
        scale.set(dr, dr, 1);
        matrix.compose(position, quatZ, scale);
        discs.setMatrixAt(nDisc, matrix);
        writeInstance(layers.disc, nDisc, e, intensity * 0.95);
        nDisc++;
      }

      // ── Pulse ring ──
      if (e.pulses && !reducedMotion && nRing < cap) {
        const rr = ringRadius(e);
        position.copy(n).multiplyScalar(R + LIFT_RING);
        scale.set(rr, rr, 1);
        matrix.compose(position, quatZ, scale);
        rings.setMatrixAt(nRing, matrix);
        if (e.live) {
          // Live now: saffron, and bright even when the timeline sits elsewhere.
          layers.ring.color.setXYZ(nRing, LIVE_RING.r, LIVE_RING.g, LIVE_RING.b);
          layers.ring.intensity.setX(nRing, Math.max(intensity, 0.75));
          layers.ring.phase.setX(nRing, e.phase);
        } else {
          writeInstance(layers.ring, nRing, e, intensity * 0.8);
        }
        nRing++;
      }

      // ── Focus reticle ──
      if (e.focus > 0.01 && nFocus < 16) {
        const fr = focusRadius(e);
        position.copy(n).multiplyScalar(R + LIFT_FOCUS);
        scale.set(fr, fr, 1);
        matrix.compose(position, quatZ, scale);
        focus.setMatrixAt(nFocus, matrix);
        // The reticle is brass, not heat — it is chrome, and chrome is
        // monochrome in this product.
        layers.focus.color.setXYZ(nFocus, BRASS_LINEAR.r, BRASS_LINEAR.g, BRASS_LINEAR.b);
        layers.focus.intensity.setX(nFocus, e.focus * (0.6 + 0.4 * e.presence));
        layers.focus.phase.setX(nFocus, e.phase);
        nFocus++;
      }

      if (winterMode && e.beacon.category === 'ski' && nCrystal < cap) {
        position.copy(n).multiplyScalar(R + LIFT_CRYSTAL);
        // Keep crystals readable at world scale without letting them swell
        // into oversized overlays when the camera closes in.
        const apparentCap = Math.max(0.006, state.camera.position.distanceTo(position) * 0.017);
        const radius = Math.min(Math.max(discRadius(e) * 1.6, 0.025), apparentCap);
        scale.set(radius, radius, 1);
        matrix.compose(position, quatZ, scale);
        crystals.setMatrixAt(nCrystal, matrix);
        writeInstance(layers.crystal, nCrystal, e, intensity);
        nCrystal++;
      }
    }

    commit(pillars, layers.pillar, nPillar);
    commit(discs, layers.disc, nDisc);
    commit(rings, layers.ring, nRing);
    commit(focus, layers.focus, nFocus);
    commit(crystals, layers.crystal, nCrystal);
  });

  return (
    <group renderOrder={30}>
      <instancedMesh
        ref={ringRef}
        args={[layers.ring.geometry, materials.ring, capacity]}
        frustumCulled={false}
        renderOrder={30}
      />
      <instancedMesh
        ref={discRef}
        args={[layers.disc.geometry, materials.disc, capacity]}
        frustumCulled={false}
        renderOrder={31}
      />
      <instancedMesh
        ref={focusRef}
        args={[layers.focus.geometry, materials.focus, 16]}
        frustumCulled={false}
        renderOrder={32}
      />
      <instancedMesh
        ref={pillarRef}
        args={[layers.pillar.geometry, materials.pillar, capacity]}
        frustumCulled={false}
        renderOrder={33}
      />
      <instancedMesh
        ref={crystalRef}
        args={[layers.crystal.geometry, materials.crystal, capacity]}
        frustumCulled={false}
        renderOrder={34}
      />

      <BeaconPicker registry={registry} capacity={capacity} />
    </group>
  );
}

const BRASS_LINEAR = new THREE.Color('#e6cf9b');

function writeInstance(
  layer: InstancedLayer,
  slot: number,
  e: BeaconEntry,
  intensity: number,
): void {
  layer.color.setXYZ(slot, e.color.r, e.color.g, e.color.b);
  layer.intensity.setX(slot, intensity);
  layer.phase.setX(slot, e.phase);
}

function commit(
  mesh: THREE.InstancedMesh,
  layer: InstancedLayer,
  count: number,
): void {
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
  layer.color.needsUpdate = true;
  layer.intensity.needsUpdate = true;
  layer.phase.needsUpdate = true;
}

export const BeaconField = memo(BeaconFieldImpl);
export default BeaconField;
