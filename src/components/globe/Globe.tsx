'use client';

/**
 * dope.travel — the globe.
 *
 * An obsidian planet in the dark with cities burning on it. Everything on
 * screen is a pure function of two things: the `beacons` prop and the two
 * stores. The renderer holds no event data of its own, computes no relevance,
 * and decides no heat — if something looks wrong, the fix is upstream.
 *
 * Composition, back to front:
 *
 *   Starfield    a restrained sky, so the background is not flat black
 *   Earth        ocean, land, coastline, borders, graticule, terminator
 *   Atmosphere   two additive back-faced shells for the limb glow
 *   BeaconField  the point of the whole thing
 *   CameraRig    orbit + flight, driving the camera around a stationary globe
 *   Effects      bloom, vignette, aberration — quality-gated
 *
 * `Globe` is the default export and expects to be mounted client-side. If you
 * are importing this from a page shell, import `GlobeStage` instead — it does
 * the `ssr: false` dance for you.
 */

import {
  Component,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import type { Beacon, GeoPoint } from '@/lib/types';
import { useGlobeStore } from '@/lib/stores/useGlobeStore';
import { VOID } from '@/lib/geo/heat';
import { latLonToVec3 } from '@/lib/geo/projection';
import { OPENING_GLOBE_DISTANCE as INITIAL_DISTANCE } from '@/lib/geo/camera';
import { Earth } from './Earth';
import { Atmosphere } from './Atmosphere';
import { Starfield } from './Starfield';
import { BeaconField } from './BeaconField';
import { CameraRig } from './CameraRig';
import { Effects } from './Effects';
import { GlobeFallback } from './GlobeFallback';
import { TravelRoute } from './TravelRoute';
import { ViewerMarker, type ViewerMarkerInfo } from './ViewerMarker';

const DEFAULT_INITIAL_VIEW: GeoPoint = { lat: 24, lon: 8 };

export interface GlobeProps {
  beacons: Beacon[];
  className?: string;
  /** Gives ski beacons ice-crystal marks and cools the limb light. */
  winterMode?: boolean;
  /** Opening viewpoint only. Runtime movement continues through useGlobeStore. */
  initialView?: GeoPoint;
  /** Render only when location provenance is browser or explicit city choice. */
  viewerMarker?: ViewerMarkerInfo;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene
// ─────────────────────────────────────────────────────────────────────────────

interface SceneProps {
  beacons: Beacon[];
  winterMode?: boolean;
  onReady: () => void;
  initialView: GeoPoint;
  viewerMarker?: ViewerMarkerInfo;
}

/**
 * Scene contents. Exported so a host that already owns a `<Canvas>` (a
 * storybook, a comparison harness) can drop the world into it directly.
 */
export function GlobeScene({ beacons, winterMode, onReady, initialView, viewerMarker }: SceneProps) {
  return (
    <>
      {/* The globe is lit entirely by its own shaders, so the only real light
          in the scene is a whisper of ambient to keep any future standard
          material from rendering pure black. */}
      <ambientLight intensity={0.15} />

      <Starfield />
      <Earth onLoaded={onReady} />
      <Atmosphere winterMode={winterMode} />
      <BeaconField beacons={beacons} winterMode={winterMode} />
      <TravelRoute />
      {viewerMarker && <ViewerMarker {...viewerMarker} />}

      <CameraRig
        initialDistance={INITIAL_DISTANCE}
        initialLat={initialView.lat}
        initialLon={initialView.lon}
      />
      <Effects />
    </>
  );
}

/** Watches for WebGL context loss and reports it upward. */
function ContextWatch({
  onLost,
  onRestored,
}: {
  onLost: () => void;
  onRestored: () => void;
}) {
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const canvas = gl.domElement;

    const handleLost = (e: Event) => {
      // Preventing the default is what makes restoration possible at all.
      e.preventDefault();
      onLost();
    };
    const handleRestored = () => onRestored();

    canvas.addEventListener('webglcontextlost', handleLost);
    canvas.addEventListener('webglcontextrestored', handleRestored);

    return () => {
      canvas.removeEventListener('webglcontextlost', handleLost);
      canvas.removeEventListener('webglcontextrestored', handleRestored);
    };
  }, [gl, onLost, onRestored]);

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas
// ─────────────────────────────────────────────────────────────────────────────

export interface GlobeCanvasProps extends GlobeProps {
  onContextLost?: () => void;
  onContextRestored?: () => void;
}

/**
 * The `<Canvas>` and nothing else. Split out from `Globe` so the error boundary
 * and the context-loss overlay can live in ordinary DOM above it.
 */
export function GlobeCanvas({
  beacons,
  winterMode,
  className,
  initialView = DEFAULT_INITIAL_VIEW,
  viewerMarker,
  onContextLost,
  onContextRestored,
}: GlobeCanvasProps) {
  const setReady = useGlobeStore((s) => s.setReady);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleReady = useCallback(() => setReady(true), [setReady]);

  useEffect(() => () => setReady(false), [setReady]);

  useEffect(() => {
    // R3F waits for react-use-measure to report the Canvas container's size
    // before it creates a renderer. Some embedded browsers miss that first
    // ResizeObserver notification when the stage is already laid out. Its
    // window-resize listener provides a second measurement path; request one
    // frame after mount only if the canvas is still at its default size.
    const frame = window.requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      const container = canvas?.parentElement;
      if (!canvas || !container || canvas.style.width) return;
      const bounds = container.getBoundingClientRect();
      if (bounds.width > 0 && bounds.height > 0) {
        window.dispatchEvent(new Event('resize'));
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const background = useMemo(() => new THREE.Color(VOID), []);
  const initialCameraPosition = useMemo(() => {
    const position = latLonToVec3(
      initialView.lat,
      initialView.lon,
      INITIAL_DISTANCE,
    );
    return [position.x, position.y, position.z] as [number, number, number];
  }, [initialView.lat, initialView.lon]);

  return (
    <Canvas
      ref={canvasRef}
      className={className}
      dpr={[1, 2]}
      gl={{
        antialias: true,
        powerPreference: 'high-performance',
        alpha: false,
        stencil: false,
        depth: true,
        preserveDrawingBuffer: false,
      }}
      // Frame zero and CameraRig start from the same geographic direction, so
      // the member never sees the old Africa-facing default before context wins.
      camera={{
        fov: 34,
        near: 0.02,
        far: 400,
        position: initialCameraPosition,
      }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.08;
        gl.setClearColor(background, 1);
        scene.background = background;
      }}
    >
      <ContextWatch
        onLost={onContextLost ?? noop}
        onRestored={onContextRestored ?? noop}
      />
      <GlobeScene
        beacons={beacons}
        winterMode={winterMode}
        onReady={handleReady}
        initialView={initialView}
        viewerMarker={viewerMarker}
      />
    </Canvas>
  );
}

function noop() {}

// ─────────────────────────────────────────────────────────────────────────────
// Error boundary
// ─────────────────────────────────────────────────────────────────────────────

interface BoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  onError?: () => void;
}

interface BoundaryState {
  failed: boolean;
}

/**
 * WebGL initialisation throws synchronously on machines that cannot provide a
 * context (locked-down enterprise images, some VMs, a browser that has run out
 * of contexts). Without this the whole page unmounts and the user gets a blank
 * document instead of a product with one missing panel.
 */
class GlobeErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    this.props.onError?.();
    if (process.env.NODE_ENV !== 'production') {
      console.error('[dope.travel] globe failed to initialise', error);
    }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

function GlobeImpl({
  beacons,
  winterMode,
  className,
  initialView = DEFAULT_INITIAL_VIEW,
  viewerMarker,
}: GlobeProps) {
  const [contextLost, setContextLost] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const ready = useGlobeStore((s) => s.ready);
  const setReady = useGlobeStore((s) => s.setReady);

  const restoreTimer = useRef<number | null>(null);

  const handleLost = useCallback(() => {
    setContextLost(true);
    setReady(false);
  }, [setReady]);

  const handleRestored = useCallback(() => {
    // A restored context needs a beat before it is worth looking at again.
    if (restoreTimer.current) window.clearTimeout(restoreTimer.current);
    restoreTimer.current = window.setTimeout(() => setContextLost(false), 250);
  }, []);

  useEffect(
    () => () => {
      if (restoreTimer.current) window.clearTimeout(restoreTimer.current);
    },
    [],
  );

  return (
    <div className={`relative h-full w-full ${className ?? ''}`}>
      <GlobeErrorBoundary fallback={<GlobeFallback kind="unsupported" />} onError={() => setUnsupported(true)}>
        <GlobeCanvas
          beacons={beacons}
          winterMode={winterMode}
          initialView={initialView}
          viewerMarker={viewerMarker}
          onContextLost={handleLost}
          onContextRestored={handleRestored}
        />
      </GlobeErrorBoundary>

      {contextLost && <GlobeFallback kind="context-lost" overlay />}
      {!contextLost && !unsupported && !ready && <GlobeFallback kind="loading" overlay />}
      {viewerMarker && <span className="sr-only">Your map position: {viewerMarker.label}</span>}
    </div>
  );
}

export const Globe = memo(GlobeImpl);
export default Globe;
