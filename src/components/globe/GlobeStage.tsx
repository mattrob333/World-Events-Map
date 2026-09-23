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
  return (
    <div
      className={`relative h-full w-full ${className ?? ''}`}
      role="group"
      aria-label={winterMode ? 'Interactive world globe with ski scenes' : 'Interactive world globe'}
    >
      <Globe beacons={beacons} initialView={initialView} viewerMarker={viewerMarker} winterMode={winterMode} />
      {winterMode && <WinterGlobeLegend beacons={beacons} />}
    </div>
  );
}

export default GlobeStage;
