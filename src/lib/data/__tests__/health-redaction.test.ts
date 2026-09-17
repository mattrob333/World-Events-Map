import { afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { HealthTracker, HttpError } from '../adapters/http';
afterEach(() => vi.unstubAllEnvs());
it('never exposes credential-bearing vendor URLs or bodies through public health', () => {
  vi.stubEnv('TEST_SOURCE_KEY', 'secret-value');
  const tracker = new HealthTracker('test', 'test', ['TEST_SOURCE_KEY']);
  tracker.markError(new HttpError(403, 'https://example.org?key=secret-value', 'Invalid secret-value'));
  expect(tracker.health().detail).toContain('403');
  expect(JSON.stringify(tracker.health())).not.toContain('secret-value');
  tracker.markError(new Error('token secret-value'));
  expect(JSON.stringify(tracker.health())).not.toContain('secret-value');
});
