/** POST /api/admin/refresh — explicitly authorized, process-local vendor refresh. */
import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getEventById } from '@/lib/data';
import { getSourceHealth, MAX_IDS, refreshSignals, sweepAllSignals } from '@/lib/data/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const headers = { 'Cache-Control': 'no-store' };

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers });
}

export async function POST(request: Request) {
  const token = process.env.REFRESH_ADMIN_TOKEN;
  if (!token?.trim()) return error('Refresh is not configured', 503);

  const supplied = /^Bearer (\S+)$/i.exec(request.headers.get('authorization') ?? '')?.[1] ?? '';
  // Compare fixed-length digests in constant time, including different-length
  // bearer tokens. Never expose credentials in responses or diagnostics.
  const digest = (value: string) => createHash('sha256').update(value).digest();
  if (!timingSafeEqual(digest(supplied), digest(token))) return error('Unauthorized', 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error('Invalid JSON body', 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return error('Expected an object with ids or all: true', 400);
  }

  const { ids, all } = body as { ids?: unknown; all?: unknown };
  if (all !== undefined && typeof all !== 'boolean') return error('all must be a boolean', 400);

  // ids take precedence, even with all: true: a subset can never silently
  // expand into a sweep, and an oversized subset cannot bypass the cap.
  if (ids !== undefined) {
    if (!Array.isArray(ids) || !ids.every((id): id is string => typeof id === 'string')) {
      return error('ids must be an array of strings', 400);
    }
    if (ids.length > MAX_IDS) return error(`At most ${MAX_IDS} ids are allowed`, 400);
    const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    const unknownIds = unique.filter((id) => !getEventById(id));
    const signals = await refreshSignals(unique, { force: true });
    return NextResponse.json({ signals, unknownIds, sources: getSourceHealth() }, { headers });
  }

  if (all !== true) return error('Supply ids or all: true', 400);
  const signals = await sweepAllSignals();
  return NextResponse.json({ signals, unknownIds: [], sources: getSourceHealth() }, { headers });
}
