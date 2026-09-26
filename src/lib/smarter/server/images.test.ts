import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { privateAddress } = await import('./images');

describe('privateAddress', () => {
  it.each(['10.0.0.1', '127.0.0.1', '169.254.169.254', '172.16.4.2', '192.168.1.1', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:10.1.2.3'])('%s is private', (address) => {
    expect(privateAddress(address)).toBe(true);
  });
  it.each(['8.8.8.8', '151.101.1.69', '2606:4700::6810:85e5'])('%s is public', (address) => {
    expect(privateAddress(address)).toBe(false);
  });
});
