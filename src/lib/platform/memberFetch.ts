'use client';

import { getPlatformClient } from './client';

/**
 * fetch for members-only routes: adds the signed-in member's session token.
 * Signed out, it sends the request without one and the route answers 401
 * ("Sign in to use this.").
 */
export async function memberFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const client = getPlatformClient();
  const token = client ? (await client.auth.getSession().catch(() => null))?.data.session?.access_token : undefined;
  if (!token) return fetch(input, init);
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
