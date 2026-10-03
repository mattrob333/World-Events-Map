'use client';

import { useEffect, useState } from 'react';
import type { SceneItem, SkiRange, SkiResort } from './types';

export interface SkiData {
  ranges: readonly SkiRange[];
  resorts: readonly SkiResort[];
  scene: readonly SceneItem[];
  resortById: Map<string, SkiResort>;
  rangeById: Map<string, SkiRange>;
  sceneById: Map<string, SceneItem>;
}

let loaded: SkiData | null = null;
let loading: Promise<SkiData> | null = null;

/** Loads the ski data once, in its own chunk. */
export function loadSkiData(): Promise<SkiData> {
  loading ??= import('./data').then((m) => (loaded = {
    ranges: m.SKI_RANGES,
    resorts: m.SKI_RESORTS,
    scene: m.SKI_SCENE,
    resortById: new Map(m.SKI_RESORTS.map((resort) => [resort.id, resort])),
    rangeById: new Map(m.SKI_RANGES.map((range) => [range.id, range])),
    sceneById: new Map(m.SKI_SCENE.map((item) => [item.id, item])),
  }));
  return loading;
}

/** The ski data, or null until it has loaded. */
export function useSkiData(): SkiData | null {
  const [data, setData] = useState<SkiData | null>(loaded);
  useEffect(() => {
    if (data) return;
    let live = true;
    void loadSkiData().then((value) => {
      if (live) setData(value);
    });
    return () => {
      live = false;
    };
  }, [data]);
  return data;
}
