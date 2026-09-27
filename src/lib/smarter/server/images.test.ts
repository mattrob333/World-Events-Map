import type { LookupAddress } from 'node:dns';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const answers = vi.hoisted(() => ({ current: [] as LookupAddress[], hosts: [] as string[] }));
vi.mock('node:dns', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:dns')>()),
  lookup: (hostname: string, _options: unknown, callback: (error: Error | null, found: LookupAddress[]) => void) => {
    answers.hosts.push(hostname);
    setImmediate(() => callback(null, answers.current));
  },
}));
const { privateAddress, publicLookup, previewImages } = await import('./images');

afterEach(() => {
  answers.current = [];
  answers.hosts = [];
});

describe('privateAddress', () => {
  it.each([
    '10.0.0.1', '127.0.0.1', '169.254.169.254', '172.16.4.2', '192.168.1.1', '100.64.0.1', '0.0.0.0', '192.0.0.170', '198.18.0.1', '224.0.0.1',
    '::', '::1', 'fd00::1', 'fe80::1', 'ff02::1', '::ffff:10.1.2.3', '::ffff:a01:203', '::ffff:7f00:1', '::10.1.2.3',
    // NAT64 (64:ff9b::/96 and the local-use 64:ff9b:1::/48) can wrap any IPv4 address, private ones included.
    '64:ff9b::a9fe:a9fe', '64:ff9b::169.254.169.254', '64:ff9b::808:808', '64:ff9b:1::a01:203',
    'not-an-address', '',
  ])('%s is refused', (address) => {
    expect(privateAddress(address)).toBe(true);
  });
  it.each(['8.8.8.8', '151.101.1.69', '2606:4700::6810:85e5', '::ffff:8.8.8.8', '2a00:1450:4001::200e'])('%s is public', (address) => {
    expect(privateAddress(address)).toBe(false);
  });
});

function resolve(hostname: string, all: boolean): Promise<{ error: (Error & { code?: string }) | null; address: unknown; family?: number }> {
  return new Promise((done) => {
    publicLookup(hostname, { all }, ((error: Error | null, address: unknown, family?: number) => done({ error, address, family })) as never);
  });
}

describe('publicLookup (runs when the socket connects, so the address checked is the address dialled)', () => {
  it('passes public answers through, in the shape Node asked for', async () => {
    answers.current = [{ address: '93.184.215.14', family: 4 }, { address: '2606:2800:21f:cb07:6820:80da:af6b:8b2c', family: 6 }];
    expect(await resolve('news.example', false)).toEqual({ error: null, address: '93.184.215.14', family: 4 });
    expect(await resolve('news.example', true)).toEqual({ error: null, address: answers.current, family: undefined });
  });

  it('refuses the whole name when any answer is private, rebinding or not', async () => {
    answers.current = [{ address: '93.184.215.14', family: 4 }, { address: '127.0.0.1', family: 4 }];
    const mixed = await resolve('rebind.example', false);
    expect(mixed.error?.code).toBe('EPRIVATE');
    answers.current = [{ address: '64:ff9b::a9fe:a9fe', family: 6 }];
    expect((await resolve('nat64.example', true)).error?.code).toBe('EPRIVATE');
    answers.current = [];
    expect((await resolve('nothing.example', false)).error).not.toBeNull();
  });
});

describe('previewImages', () => {
  it('resolves through the checked lookup at connect time and never reaches a private address', async () => {
    answers.current = [{ address: '169.254.169.254', family: 4 }];
    const images = await previewImages(['https://metadata.example/story']);
    expect(images.get('https://metadata.example/story')).toBeNull();
    expect(answers.hosts).toContain('metadata.example');
  });

  it('refuses non-https, odd ports, IP literals and local names without any lookup', async () => {
    const urls = ['http://news.example/a', 'https://news.example:8443/a', 'https://10.0.0.1/a', 'https://[::1]/a', 'https://printer.local/a'];
    const images = await previewImages(urls);
    for (const url of urls) expect(images.get(url)).toBeNull();
    expect(answers.hosts).toEqual([]);
  });
});
