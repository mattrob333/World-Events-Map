import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/platform/usePlatformAuth', () => ({ usePlatformAuth: () => ({}) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({}), useSearchParams: () => new URLSearchParams() }));

const { safeNext } = await import('./LoginScreen');

describe('login redirect', () => {
  it('only goes back to same-site paths', () => {
    expect(safeNext('/trips/designer?place=Lisbon')).toBe('/trips/designer?place=Lisbon');
    expect(safeNext(null)).toBe('/');
    expect(safeNext('https://evil.example')).toBe('/');
    expect(safeNext('//evil.example')).toBe('/');
    expect(safeNext('/\\evil.example')).toBe('/');
    expect(safeNext('/login?next=/')).toBe('/');
    expect(safeNext('javascript:alert(1)')).toBe('/');
  });
});
