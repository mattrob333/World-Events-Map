import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { SHARED_CLIENT_KEY, checkBoundary, clientKey, consumeProviderCall, ipKey, originAllowed, resetDesignerLimitsForTests } from './guard';

function req(headers: Record<string, string>, url = 'http://localhost/api/designer/research') {
  return new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: '{}' });
}

afterEach(() => {
  vi.unstubAllEnvs();
  resetDesignerLimitsForTests();
});

describe('ipKey', () => {
  it('keeps IPv4, unwraps IPv4-mapped IPv6, and groups IPv6 by /64', () => {
    expect(ipKey('203.0.113.9')).toBe('203.0.113.9');
    expect(ipKey('203.0.113.9, 10.0.0.1')).toBe('203.0.113.9');
    expect(ipKey('::ffff:203.0.113.9')).toBe('203.0.113.9');
    expect(ipKey('2001:db8:1:2::1')).toBe('2001:0db8:0001:0002::/64');
    expect(ipKey('2001:db8:1:2:ffff:eeee:dddd:cccc')).toBe(ipKey('2001:db8:1:2::abcd'));
    expect(ipKey('2001:db8:1:3::1')).not.toBe(ipKey('2001:db8:1:2::1'));
  });

  it('rejects things that are not addresses', () => {
    for (const bad of ['', 'anonymous', '999.1.1.1', '1:2:3', '1::2::3', 'evil<script>', 'g::1']) expect(ipKey(bad)).toBeNull();
  });
});

describe('clientKey', () => {
  it('ignores client-supplied IP headers off Vercel and uses one shared key', () => {
    vi.stubEnv('VERCEL', '');
    const keys = new Set(['1.1.1.1', '2.2.2.2', '3.3.3.3'].map((ip) => clientKey(req({ 'x-vercel-forwarded-for': ip, 'x-real-ip': ip, 'x-forwarded-for': ip }))));
    expect([...keys]).toEqual([SHARED_CLIENT_KEY]);
  });

  it('uses the platform-set address on Vercel, by /64 for IPv6', () => {
    vi.stubEnv('VERCEL', '1');
    expect(clientKey(req({ 'x-real-ip': '198.51.100.7' }))).toBe('198.51.100.7');
    expect(clientKey(req({ 'x-real-ip': '2001:db8:aa:bb::1' }))).toBe(clientKey(req({ 'x-real-ip': '2001:db8:aa:bb::9999' })));
    expect(clientKey(req({}))).toBe(SHARED_CLIENT_KEY);
  });

  it('trusts a proxy header off Vercel only when the operator names it', () => {
    vi.stubEnv('VERCEL', '');
    vi.stubEnv('TRUSTED_CLIENT_IP_HEADER', 'X-Real-IP');
    expect(clientKey(req({ 'x-real-ip': '198.51.100.7' }))).toBe('198.51.100.7');
    expect(clientKey(req({ 'x-vercel-forwarded-for': '198.51.100.8' }))).toBe(SHARED_CLIENT_KEY);
  });

  it('cannot be rotated around with spoofed headers', () => {
    vi.stubEnv('VERCEL', '');
    let allowed = 0;
    for (let i = 0; i < 100; i += 1) if (consumeProviderCall(req({ 'x-vercel-forwarded-for': `10.0.0.${i}` }), 'research')) allowed += 1;
    expect(allowed).toBe(4);
  });
});

describe('consumeProviderCall', () => {
  it('can charge several units at once and refuses a charge that would pass the limit', () => {
    const r = req({});
    expect(consumeProviderCall(r, 'mcp', 0, 200)).toBe(true);
    expect(consumeProviderCall(r, 'mcp', 0, 41)).toBe(false);
    expect(consumeProviderCall(r, 'mcp', 0, 40)).toBe(true);
    expect(consumeProviderCall(r, 'mcp', 0, 1)).toBe(false);
  });
});

describe('same-origin boundary', () => {
  const sameSite = (origin: string, extra: Record<string, string> = {}) => req({ Origin: origin, 'Sec-Fetch-Site': 'same-origin', ...extra });

  it('accepts the configured site and Vercel deployment URLs, not the request’s own Host', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://dope.travel');
    vi.stubEnv('VERCEL_URL', 'world-events-map-abc123.vercel.app');
    vi.stubEnv('VERCEL_BRANCH_URL', 'world-events-map-git-main.vercel.app');
    expect(checkBoundary(sameSite('https://dope.travel'))).toBeNull();
    expect(checkBoundary(sameSite('https://world-events-map-abc123.vercel.app'))).toBeNull();
    expect(checkBoundary(sameSite('https://world-events-map-git-main.vercel.app'))).toBeNull();
    // Origin and Host both forged: previously passed, now refused.
    expect(checkBoundary(req({ Origin: 'https://evil.example', Host: 'evil.example', 'X-Forwarded-Host': 'evil.example' }, 'https://evil.example/api/designer/research'))?.status).toBe(403);
    // Loopback is not an allowed origin on a Vercel production deployment.
    expect(checkBoundary(sameSite('http://localhost:3127'))?.status).toBe(403);
    expect(originAllowed('null')).toBe(false);
  });

  it('keeps local dev and next start working', () => {
    vi.stubEnv('VERCEL', '');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    for (const port of ['3100', '3127', '3128']) expect(checkBoundary(sameSite(`http://localhost:${port}`))).toBeNull();
    expect(checkBoundary(sameSite('http://127.0.0.1:3100'))).toBeNull();
    expect(checkBoundary(sameSite('https://evil.example'))?.status).toBe(403);
    expect(checkBoundary(req({ Origin: 'http://localhost:3100', 'Sec-Fetch-Site': 'cross-site' }))?.status).toBe(403);
  });
});
