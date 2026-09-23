import { describe, expect, it } from 'vitest';
import { sanitizeFromPath } from './from';

describe('sanitizeFromPath', () => {
  it('accepts a same-origin relative path', () => {
    expect(sanitizeFromPath('/destinations/aspen')).toBe('/destinations/aspen');
  });

  it('rejects an absolute URL with a scheme', () => {
    expect(sanitizeFromPath('https://evil.com')).toBe('/');
  });

  it('rejects a protocol-relative path', () => {
    expect(sanitizeFromPath('//evil.com')).toBe('/');
  });

  it('rejects a javascript: pseudo-scheme', () => {
    expect(sanitizeFromPath('javascript:x')).toBe('/');
  });

  it('rejects the backslash protocol-relative trick', () => {
    expect(sanitizeFromPath('/\\evil.com')).toBe('/');
  });

  it('falls back to / for missing or empty values', () => {
    expect(sanitizeFromPath(null)).toBe('/');
    expect(sanitizeFromPath(undefined)).toBe('/');
    expect(sanitizeFromPath('')).toBe('/');
  });

  it('accepts the root path unchanged', () => {
    expect(sanitizeFromPath('/')).toBe('/');
  });
});
