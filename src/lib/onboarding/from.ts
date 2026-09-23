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
  if (typeof raw !== 'string' || raw.length === 0) return '/';
  if (raw[0] !== '/' || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  return raw;
}
