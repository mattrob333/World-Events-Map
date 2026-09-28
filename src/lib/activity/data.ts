import raw from '@/data/activities/activities.json';
import type { Activity } from './activities';

/**
 * The curated list of spots and events (about 340 KB). Server code and tests
 * import it directly; client code loads it on demand with `useActivities`, so
 * it never weighs down a page's first load.
 */
export const ACTIVITIES = raw as Activity[];
