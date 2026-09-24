import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { serverCapabilities, siteOrigin } from '../capabilities';

describe('serverCapabilities', () => {
  it('reports only what is configured', () => {
    expect(serverCapabilities({})).toEqual({ spotifyPlaylist: false, spotifySignIn: false, events: false, eventSources: [] });
    // A public client id alone allows sign-in but not reading public links (UFR2-F04).
    expect(serverCapabilities({ NEXT_PUBLIC_SPOTIFY_CLIENT_ID: 'id' })).toMatchObject({ spotifyPlaylist: false, spotifySignIn: true });
    expect(serverCapabilities({ SPOTIFY_CLIENT_ID: 'id', SPOTIFY_CLIENT_SECRET: 's' })).toMatchObject({ spotifyPlaylist: true, spotifySignIn: false });
    expect(serverCapabilities({ SEATGEEK_CLIENT_ID: 'x' })).toMatchObject({ events: true, eventSources: ['seatgeek'] });
  });
});

describe('siteOrigin (UFR2-K12)', () => {
  it('uses configured URLs, never a request header', () => {
    expect(siteOrigin({ NEXT_PUBLIC_SITE_URL: 'https://dope.travel/' })).toBe('https://dope.travel');
    expect(siteOrigin({ VERCEL_PROJECT_PRODUCTION_URL: 'dope.travel' })).toBe('https://dope.travel');
    expect(siteOrigin({ VERCEL_URL: 'app-abc.vercel.app' })).toBe('https://app-abc.vercel.app');
    expect(siteOrigin({ NEXT_PUBLIC_SITE_URL: 'javascript:alert(1)', NODE_ENV: 'production' })).toBe('https://dope.travel');
    expect(siteOrigin({ NODE_ENV: 'development', PORT: '3128' })).toBe('http://localhost:3128');
  });
});
