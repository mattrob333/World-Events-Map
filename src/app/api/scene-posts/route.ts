import { NextResponse } from 'next/server';
import { getEventById } from '@/lib/data';
import { readScenePosts } from '@/lib/data/social-feed';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('event') ?? '';
  if (!getEventById(id))
    return NextResponse.json(
      { posts: [], fetchedAt: null },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  try {
    return NextResponse.json(await readScenePosts(id), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json(
      {
        posts: [],
        fetchedAt: null,
        error: 'Scene feed temporarily unavailable',
      },
      { status: 503 },
    );
  }
}
