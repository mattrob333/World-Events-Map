import resortsJson from '@/data/ski/resorts.json';
import sceneJson from '@/data/ski/scene.json';
import { RANGES } from './ranges';
import type { SceneItem, SkiRange, SkiResort } from './types';

/** The checked ski data, typed. Imported through `useSkiData` so it loads in its own chunk. */
export const SKI_RANGES: readonly SkiRange[] = RANGES;
export const SKI_RESORTS = resortsJson as unknown as readonly SkiResort[];
export const SKI_SCENE = sceneJson as unknown as readonly SceneItem[];
