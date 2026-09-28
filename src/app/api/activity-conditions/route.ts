/**
 * GET /api/activity-conditions?id=<activityId>&units=imperial|metric
 *
 * Live conditions for one activity on the map (snow, surf, beach, aurora, event
 * countdown, or general weather), fetched here on the server so the Open-Meteo
 * key never reaches a browser. Answers `{ conditions: Conditions | null }`.
 *
 * - Only ids in the curated activity list are served, and only `id` and `units`
 *   are accepted, so the edge cache holds at most two entries per activity and
 *   junk query strings can't be used to push past it to the paid upstream.
 * - Cached at the edge per kind: six hours for model output, fifteen minutes for
 *   aurora (Kp moves fast), an hour for events (no network at all).
 * - When the upstream fails, the answer is `{ conditions: null }` on a five-minute
 *   cache. Never an invented value. A partial answer (one of two upstreams failed)
 *   also gets the short cache.
 */

import { NextResponse } from 'next/server';
import { ACTIVITIES, byId, type Activity } from '@/lib/activity/activities';
import { conditionsKind, fetcherFor, type Conditions, type ConditionsKindName, type Units } from '@/lib/activity/conditions';
import { UpstreamError } from '@/lib/activity/conditions/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ID_RE = /^[a-z0-9][a-z0-9-]{0,119}$/;
const ALLOWED_PARAMS = new Set(['id', 'units']);

const MODEL = 'public, max-age=0, s-maxage=21600, stale-while-revalidate=3600';
const CACHE: Record<ConditionsKindName, string> = {
  snow: MODEL,
  marine: MODEL,
  beach: MODEL,
  weather: MODEL,
  aurora: 'public, max-age=0, s-maxage=900, stale-while-revalidate=300',
  event: 'public, max-age=0, s-maxage=3600, stale-while-revalidate=600',
};
const CACHE_FAILED = 'public, max-age=0, s-maxage=300';

let index: Map<string, Activity> | null = null;

function bad(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  for (const key of params.keys()) if (!ALLOWED_PARAMS.has(key)) return bad(`unknown parameter: ${key.slice(0, 40)}`, 400);
  const ids = params.getAll('id');
  const id = ids[0] ?? '';
  if (ids.length !== 1 || !ID_RE.test(id)) return bad('id must be an activity id', 400);
  const unitsParam = params.getAll('units');
  if (unitsParam.length > 1) return bad('units must be imperial or metric', 400);
  const units = (unitsParam[0] ?? 'imperial') as Units;
  if (units !== 'imperial' && units !== 'metric') return bad('units must be imperial or metric', 400);

  index ??= byId(ACTIVITIES);
  const activity = index.get(id);
  if (!activity) return bad('unknown activity', 404);

  const kind = conditionsKind(activity);
  let partial = false;
  let conditions: Conditions | null;
  try {
    conditions = await fetcherFor(activity)(activity, {
      units,
      now: new Date(),
      onUpstreamError: () => {
        partial = true;
      },
    });
  } catch (err) {
    console.warn('activity-conditions upstream failed', kind, err instanceof UpstreamError ? err.message : err instanceof Error ? err.name : 'error');
    return NextResponse.json({ conditions: null }, { headers: { 'Cache-Control': CACHE_FAILED } });
  }
  return NextResponse.json({ conditions }, { headers: { 'Cache-Control': partial ? CACHE_FAILED : CACHE[kind] } });
}
