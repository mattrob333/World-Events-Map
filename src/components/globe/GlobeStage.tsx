'use client';

/**
 * The SSR-safe entry point. Import this from the page shell, not `Globe`.
 *
 * `next/dynamic` with `ssr: false` is only legal inside a Client Component, so
 * the boundary lives here rather than being every consumer's problem. Nothing
 * in the WebGL tree ever runs on the server, and the shell gets a rendered
 * placeholder in its place during hydration.
 */

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { useGlobeStore } from '@/lib/stores/useGlobeStore';
import type { Beacon, GeoPoint } from '@/lib/types';
import { GlobeFallback } from './GlobeFallback';
import type { ViewerMarkerInfo } from './ViewerMarker';
import { WinterGlobeLegend } from './WinterGlobeLegend';

const Globe = dynamic(() => import('./Globe'), {
  ssr: false,
  loading: () => <GlobeFallback kind="loading" />,
});

export interface GlobeStageProps {
  beacons: Beacon[];
  className?: string;
  initialView?: GeoPoint;
  viewerMarker?: ViewerMarkerInfo;
  winterMode?: boolean;
}

export function GlobeStage({
  beacons,
  className,
  initialView,
  viewerMarker,
  winterMode = false,
}: GlobeStageProps) {
  // The WebGL globe is the single most expensive thing on the page, and it sits
  // below the fold. Mount it when the traveler gets within a screen of it (or
  // asks it to fly somewhere), and stop drawing frames while it's off-screen.
  const rootRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const flightPending = useGlobeStore((s) => s.flight !== null);
  const mounted = near || flightPending;

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') {
      const timer = window.setTimeout(() => { setNear(true); setOnScreen(true); }, 0);
      return () => window.clearTimeout(timer);
    }
    const nearby = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) setNear(true);
    }, { rootMargin: '100% 0px' });
    const visible = new IntersectionObserver(([entry]) => setOnScreen(Boolean(entry?.isIntersecting)));
    nearby.observe(root);
    visible.observe(root);
    return () => {
      nearby.disconnect();
      visible.disconnect();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`relative h-full w-full ${className ?? ''}`}
      role="group"
      aria-label={winterMode ? 'Interactive world globe with ski scenes' : 'Interactive world globe'}
    >
      {mounted ? (
        <Globe beacons={beacons} initialView={initialView} viewerMarker={viewerMarker} winterMode={winterMode} paused={!onScreen} />
      ) : (
        <GlobeFallback kind="loading" />
      )}
      {winterMode && <WinterGlobeLegend beacons={beacons} />}
    </div>
  );
}

export default GlobeStage;
