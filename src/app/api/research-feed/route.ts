import { NextResponse } from 'next/server';
import { readResearchFeed } from '@/lib/research/feed';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Public snapshot read. Never accepts a search query or calls a paid API. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const destination = params.get('destination');
  if (destination && !/^[a-z0-9-]{2,64}$/.test(destination)) {
    return NextResponse.json({ error: 'Invalid destination' }, { status: 400 });
  }
  const response = await readResearchFeed(destination ?? undefined);
  return NextResponse.json(response, {
    status: response.status === 'error' ? 503 : 200,
    headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60' },
  });
}
