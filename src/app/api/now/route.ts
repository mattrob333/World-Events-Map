import { NextResponse } from 'next/server';
import { executeNow } from '@/lib/now/service';
import { validateNowRequest } from '@/lib/now/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!process.env.BESTTIME_API_KEY_PRIVATE) {
    return NextResponse.json(
      {
        error: 'NOW venue intelligence is not configured yet.',
        code: 'NOW_PROVIDER_NOT_CONFIGURED',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const body: unknown = await request.json();
    const input = validateNowRequest(body);
    const result = await executeNow(input);
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'NOW could not complete this request.';
    const validation =
      message.includes('must be') ||
      message.startsWith('Choose a valid') ||
      message.startsWith('Request body') ||
      message.startsWith('Each interest');
    return NextResponse.json(
      {
        error: validation ? message : 'NOW could not retrieve venue intelligence. Try again shortly.',
        code: validation ? 'INVALID_NOW_REQUEST' : 'NOW_PROVIDER_ERROR',
      },
      {
        status: validation ? 400 : 502,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
}
