/**
 * Validates a `?from=` query value as a same-origin, relative in-app path so
 * onboarding can return the visitor to the page they came from (UFR-D13).
 *
 * Accepts only paths that start with a single `/`. Rejects anything that
 * could resolve off-origin: absolute URLs with a scheme (`https://…`,
 * `javascript:…`), protocol-relative paths (`//evil.com`), and the
 * backslash variant browsers also treat as protocol-relative (`/\evil.com`).
 * Anything rejected falls back to the safe default, the home page.
 */
export function sanitizeFromPath(raw: string | null | undefined): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 512) return '/';
  // Browsers drop tabs and newlines inside URLs, so `/\t/evil.com` would
  // collapse to `//evil.com`; refuse control characters and backslashes outright.
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return '/';
  if (raw[0] !== '/' || raw.startsWith('//')) return '/';
  // Final check: resolving against a sentinel origin must stay on it.
  try {
    const base = 'https://meridian.invalid';
    const resolved = new URL(raw, base);
    if (resolved.origin !== base) return '/';
    // Dot segments collapse during resolution (`/.//evil.com` → `//evil.com`),
    // so the output must pass the same protocol-relative check as the input.
    if (resolved.pathname.startsWith('//')) return '/';
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return '/';
  }
}
