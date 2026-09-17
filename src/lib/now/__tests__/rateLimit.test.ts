import { afterEach, describe, expect, it } from 'vitest';
import { consumeNowRateLimit, resetNowRateLimitsForTests } from '../rateLimit';

function requestFor(ip: string) {
  return new Request('http://localhost/api/now', {
    headers: { 'x-forwarded-for': ip },
  });
}

afterEach(() => {
  resetNowRateLimitsForTests();
});

describe('NOW warm-instance cost guard', () => {
  it('blocks one noisy client without letting rejected calls exhaust the shared budget', () => {
    const noisy = requestFor('203.0.113.20');
    for (let index = 0; index < 12; index += 1) {
      expect(consumeNowRateLimit(noisy, 1_000).allowed).toBe(true);
    }
    for (let index = 0; index < 200; index += 1) {
      expect(consumeNowRateLimit(noisy, 1_000).allowed).toBe(false);
    }

    expect(consumeNowRateLimit(requestFor('203.0.113.21'), 1_000).allowed).toBe(true);
  });

  it('resets a client window after ten minutes', () => {
    const request = requestFor('203.0.113.30');
    for (let index = 0; index < 12; index += 1) {
      expect(consumeNowRateLimit(request, 1_000).allowed).toBe(true);
    }
    expect(consumeNowRateLimit(request, 1_000).allowed).toBe(false);
    expect(consumeNowRateLimit(request, 1_000 + 10 * 60 * 1000 + 1).allowed).toBe(true);
  });
});
