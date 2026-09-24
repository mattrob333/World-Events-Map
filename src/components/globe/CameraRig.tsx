'use client';

/**
 * Camera: orbit controls plus the flight controller.
 *
 * These are hand-rolled rather than drei's `OrbitControls`, for one reason:
 * the flight controller has to take the camera over mid-gesture, move it along
 * a great circle, and hand it back with no discontinuity. Driving somebody
 * else's internal spherical state through that is a fight; owning it is thirty
 * lines.
 *
 * The globe never moves. Auto-rotate turns the *camera*, which keeps the world
 * origin at the world origin — every shader on this globe assumes that when it
 * computes `normalize(worldPosition)` as a surface normal, and the horizon
 * tests in the beacon field assume it too.
 *
 * Conventions:
 *   `THREE.Spherical(radius, phi, theta)` with phi measured from +Y.
 *   Distances are in globe radii; the surface is 1.0.
 */

import { memo, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useGlobeStore } from '@/lib/stores/useGlobeStore';
import { useTimelineStore } from '@/lib/stores/useTimelineStore';
import { GLOBE_RADIUS, latLonToVec3 } from '@/lib/geo/projection';
import { useReducedMotion } from './useReducedMotion';
import { bindCursorTarget, setCursor } from './cursor';
import { JOURNEY_ALIGN_MS, JOURNEY_TRAVEL_MS, OPENING_GLOBE_DISTANCE } from '@/lib/geo/camera';

const R = GLOBE_RADIUS;

export const MIN_DISTANCE = 1.35;
export const MAX_DISTANCE = 5.5;

/** Matches `--duration-cinematic`. */
const FLIGHT_MS = 1400;

/** ~0.4°/s. Slow enough that you notice it only if you stop and look. */
const AUTO_ROTATE_RAD_PER_S = (0.4 * Math.PI) / 180;

/** Keeps the camera off the poles, where azimuth becomes meaningless. */
const PHI_MIN = 0.16;
const PHI_MAX = Math.PI - 0.16;

const DRAG_SENSITIVITY = 0.0042;
const ZOOM_SENSITIVITY = 0.0016;
/** Orbit damping rate, inverse seconds. */
const ORBIT_LAMBDA = 9;

interface Flight {
  from: THREE.Vector3;
  via: THREE.Vector3 | null;
  to: THREE.Vector3;
  fromRadius: number;
  toRadius: number;
  start: number;
  durationMs: number;
  alignMs: number;
  journey: boolean;
  nonce: number;
}

/** Ease matching `--ease-glide`, cubic-bezier(0.22, 1, 0.36, 1). */
function easeGlide(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

/** Spherical linear interpolation between two unit vectors. */
function slerpUnit(
  a: THREE.Vector3,
  b: THREE.Vector3,
  t: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const dot = THREE.MathUtils.clamp(a.dot(b), -1, 1);
  const omega = Math.acos(dot);
  const sin = Math.sin(omega);

  if (sin < 1e-5) return out.copy(b);

  const s0 = Math.sin((1 - t) * omega) / sin;
  const s1 = Math.sin(t * omega) / sin;
  return out.copy(a).multiplyScalar(s0).addScaledVector(b, s1).normalize();
}

function slerpStable(
  a: THREE.Vector3,
  b: THREE.Vector3,
  t: number,
  out: THREE.Vector3,
  perp: THREE.Vector3,
  axis: THREE.Vector3,
): THREE.Vector3 {
  if (a.dot(b) >= -0.9995) return slerpUnit(a, b, t, out);
  // Opposite sides of the planet have no unique great circle. Pick a stable
  // perpendicular so the camera keeps moving instead of snapping across it.
  axis.set(Math.abs(a.y) < 0.9 ? 0 : 1, Math.abs(a.y) < 0.9 ? 1 : 0, 0);
  perp.crossVectors(a, axis).normalize();
  return out.copy(a).multiplyScalar(Math.cos(Math.PI * t))
    .addScaledVector(perp, Math.sin(Math.PI * t)).normalize();
}

function easeJourney(t: number): number {
  return t * t * (3 - 2 * t);
}

export interface CameraRigProps {
  /**
   * Opening camera distance, in globe radii.
   *
   * At the Canvas's 34° FOV, 2.45 makes the sphere about 1.5× the stage
   * height. The stage crops the polar thirds into a closer cinematic view.
   */
  initialDistance?: number;
  initialLat?: number;
  initialLon?: number;
}

function CameraRigImpl({
  initialDistance = OPENING_GLOBE_DISTANCE,
  initialLat = 24,
  initialLon = 8,
}: CameraRigProps) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);

  const reducedMotion = useReducedMotion();

  const flightRequest = useGlobeStore((s) => s.flight);
  const consumeFlight = useGlobeStore((s) => s.consumeFlight);
  const autoRotate = useGlobeStore((s) => s.autoRotate);
  const setAutoRotate = useGlobeStore((s) => s.setAutoRotate);

  const state = useMemo(() => {
    const start = latLonToVec3(initialLat, initialLon, initialDistance);
    const spherical = new THREE.Spherical().setFromVector3(start);
    return {
      /** Where the camera is being asked to go. */
      target: spherical.clone(),
      /** Where it actually is; damps toward `target`. */
      current: spherical.clone(),
      dragging: false,
      pointers: new Map<number, { x: number; y: number }>(),
      pinchDistance: 0,
      flight: null as Flight | null,
      scratchA: new THREE.Vector3(),
      scratchB: new THREE.Vector3(),
      scratchC: new THREE.Vector3(),
    };
  }, [initialDistance, initialLat, initialLon]);

  // ── Input ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = gl.domElement;
    bindCursorTarget(el);

    const stopAuto = () => {
      if (useGlobeStore.getState().autoRotate) setAutoRotate(false);
      // A gesture always wins over a flight in progress.
      state.flight = null;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      el.setPointerCapture(e.pointerId);
      state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (state.pointers.size === 1) {
        state.dragging = true;
        setCursor('drag', 'grabbing');
      } else if (state.pointers.size === 2) {
        state.pinchDistance = pinchSpan(state.pointers);
      }
      stopAuto();
    };

    const onPointerMove = (e: PointerEvent) => {
      const prev = state.pointers.get(e.pointerId);
      if (!prev) return;

      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      prev.x = e.clientX;
      prev.y = e.clientY;

      if (state.pointers.size >= 2) {
        const span = pinchSpan(state.pointers);
        if (state.pinchDistance > 0 && span > 0) {
          const ratio = state.pinchDistance / span;
          state.target.radius = clampDistance(state.target.radius * ratio);
        }
        state.pinchDistance = span;
        invalidate();
        return;
      }

      if (!state.dragging) return;

      // Drag right → the globe turns with your hand.
      state.target.theta -= dx * DRAG_SENSITIVITY;
      state.target.phi = THREE.MathUtils.clamp(
        state.target.phi - dy * DRAG_SENSITIVITY,
        PHI_MIN,
        PHI_MAX,
      );
      invalidate();
    };

    const endPointer = (e: PointerEvent) => {
      state.pointers.delete(e.pointerId);
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      if (state.pointers.size < 2) state.pinchDistance = 0;
      if (state.pointers.size === 0) {
        state.dragging = false;
        setCursor('drag', '');
      }
    };

    const onWheel = (e: WheelEvent) => {
      // A plain wheel or two-finger trackpad swipe belongs to the page: the
      // globe sits inside a scrolling page, and hijacking the scroll while the
      // pointer happens to be over it zooms the planet by surprise. Zoom takes
      // an explicit gesture instead: a trackpad pinch (browsers report it as
      // ctrl+wheel) or ctrl/⌘ + wheel. When the page can't scroll anyway,
      // the plain wheel zooms as before.
      const zoomGesture = e.ctrlKey || e.metaKey;
      const root = document.scrollingElement ?? document.documentElement;
      if (!zoomGesture && root.scrollHeight > root.clientHeight + 1) return;
      const deltaY = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1);
      // Cap each event so one fast flick can't slam the camera into the surface.
      const step = THREE.MathUtils.clamp(deltaY, -120, 120);
      const next = clampDistance(state.target.radius * Math.exp(step * ZOOM_SENSITIVITY));
      if (Math.abs(next - state.target.radius) < 1e-5 && !zoomGesture) return;
      e.preventDefault();
      stopAuto();
      state.target.radius = next;
      invalidate();
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', endPointer);
    el.addEventListener('pointercancel', endPointer);
    el.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', endPointer);
      el.removeEventListener('pointercancel', endPointer);
      el.removeEventListener('wheel', onWheel);
      setCursor('drag', '');
      bindCursorTarget(null);
    };
  }, [gl, invalidate, setAutoRotate, state]);

  // ── Flight requests ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!flightRequest) return;

    const destination = latLonToVec3(
      flightRequest.target.lat,
      flightRequest.target.lon,
      1,
    );
    const from = camera.position.clone().normalize();
    const routeOrigin = flightRequest.origin
      ? latLonToVec3(flightRequest.origin.lat, flightRequest.origin.lon, 1)
      : from;
    const routeAngle = Math.acos(THREE.MathUtils.clamp(routeOrigin.dot(destination), -1, 1));
    const showRouteOverview = flightRequest.journey && routeAngle > 0.55;
    // For longer hops the camera settles between the endpoints and steps back
    // enough to keep both pins in frame. Short hops still land on the city.
    const to = showRouteOverview
      ? slerpStable(routeOrigin, destination, 0.55, new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3())
      : destination;
    const distance = clampDistance(showRouteOverview
      ? Math.max(flightRequest.distance, Math.min(4.2, OPENING_GLOBE_DISTANCE + routeAngle * 0.8))
      : flightRequest.distance);

    if (reducedMotion) {
      // Instant cut. No easing, no arc — the user asked for no motion.
      const dest = to.clone().multiplyScalar(distance);
      state.target.setFromVector3(dest);
      state.current.copy(state.target);
      camera.position.copy(dest);
      camera.lookAt(0, 0, 0);
      state.flight = null;
      consumeFlight();
      invalidate();
      return;
    }

    state.flight = {
      from,
      via: flightRequest.origin ? routeOrigin : null,
      to,
      fromRadius: camera.position.length(),
      toRadius: distance,
      start: performance.now(),
      durationMs: flightRequest.journey
        ? JOURNEY_TRAVEL_MS + (flightRequest.origin ? JOURNEY_ALIGN_MS : 0)
        : FLIGHT_MS,
      alignMs: flightRequest.origin ? JOURNEY_ALIGN_MS : 0,
      journey: flightRequest.journey,
      nonce: flightRequest.nonce,
    };

    consumeFlight();
    invalidate();
  }, [flightRequest, camera, consumeFlight, invalidate, reducedMotion, state]);

  // ── Per-frame ─────────────────────────────────────────────────────────────
  const scrubbing = useTimelineStore((s) => s.scrubbing);
  const scrubbingRef = useRef(scrubbing);
  scrubbingRef.current = scrubbing;

  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate && !reducedMotion;

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 1 / 20);
    const { scratchA, scratchB, scratchC } = state;

    if (state.flight) {
      const f = state.flight;
      const t = THREE.MathUtils.clamp(
        (performance.now() - f.start) / f.durationMs,
        0,
        1,
      );
      const alignFraction = f.alignMs / f.durationMs;
      const aligning = f.via && t < alignFraction;
      const segmentT = aligning
        ? easeGlide(t / alignFraction)
        : f.journey
          ? easeJourney((t - alignFraction) / (1 - alignFraction))
          : easeGlide(t);
      const dir = slerpStable(
        aligning ? f.from : (f.via ?? f.from),
        aligning ? f.via! : f.to,
        segmentT,
        scratchA,
        scratchB,
        scratchC,
      );

      const radius = THREE.MathUtils.lerp(f.fromRadius, f.toRadius, f.journey ? easeJourney(t) : easeGlide(t));
      camera.position.copy(dir).multiplyScalar(radius);
      camera.lookAt(0, 0, 0);

      // Keep the orbit state in lockstep so releasing the flight never snaps.
      state.target.setFromVector3(camera.position);
      state.target.phi = THREE.MathUtils.clamp(state.target.phi, PHI_MIN, PHI_MAX);
      state.current.copy(state.target);

      if (t >= 1) state.flight = null;
      return;
    }

    if (
      autoRotateRef.current &&
      !scrubbingRef.current &&
      !state.dragging
    ) {
      state.target.theta += AUTO_ROTATE_RAD_PER_S * dt;
    }

    const lambda = ORBIT_LAMBDA;
    const d = THREE.MathUtils.damp;
    state.current.theta = d(state.current.theta, state.target.theta, lambda, dt);
    state.current.phi = d(state.current.phi, state.target.phi, lambda, dt);
    state.current.radius = d(state.current.radius, state.target.radius, lambda, dt);

    state.current.phi = THREE.MathUtils.clamp(state.current.phi, PHI_MIN, PHI_MAX);
    state.current.radius = clampDistance(state.current.radius);

    camera.position.setFromSpherical(state.current);
    camera.lookAt(0, 0, 0);
  });

  // Prevent the browser's own gestures fighting the drag.
  useEffect(() => {
    const el = gl.domElement;
    const prev = el.style.touchAction;
    el.style.touchAction = 'none';
    return () => {
      el.style.touchAction = prev;
    };
  }, [gl]);

  return null;
}

function clampDistance(v: number): number {
  return THREE.MathUtils.clamp(v, MIN_DISTANCE * R, MAX_DISTANCE * R);
}

function pinchSpan(pointers: Map<number, { x: number; y: number }>): number {
  const pts = Array.from(pointers.values());
  if (pts.length < 2) return 0;
  return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
}

export const CameraRig = memo(CameraRigImpl);
export default CameraRig;
