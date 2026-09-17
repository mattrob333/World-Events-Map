import { afterEach, describe, expect, it } from 'vitest';
import {
  consumeNowClientRateLimit,
  consumeNowProviderBudget,
  resetNowRateLimitsForTests,
} from '../rateLimit';

function requestFor(ip: string) {
  return new Request('http://localhost/api/now', {
    headers: { 'x-vercel-forwarded-for': ip },
  });
}

afterEach(() => {
  resetNowRateLimitsForTests();
});

describe('NOW warm-instance cost guard', () => {
  it('blocks one noisy client without charging the shared provider budget', () => {
    const noisy = requestFor('203.0.113.20');
    for (let index = 0; index < 12; index += 1) {
      expect(consumeNowClientRateLimit(noisy, 1_000).allowed).toBe(true);
    }
    for (let index = 0; index < 200; index += 1) {
      expect(consumeNowClientRateLimit(noisy, 1_000).allowed).toBe(false);
    }

    // Client admission alone never consumes the shared paid-provider budget.
    for (let index = 0; index < 120; index += 1) {
      expect(consumeNowProviderBudget(1_000).allowed).toBe(true);
    }
    expect(consumeNowProviderBudget(1_000).allowed).toBe(false);
  });

  it('resets a client window after ten minutes', () => {
    const request = requestFor('203.0.113.30');
    for (let index = 0; index < 12; index += 1) {
      expect(consumeNowClientRateLimit(request, 1_000).allowed).toBe(true);
    }
    expect(consumeNowClientRateLimit(request, 1_000).allowed).toBe(false);
    expect(consumeNowClientRateLimit(request, 1_000 + 10 * 60 * 1000 + 1).allowed).toBe(true);
  });

  it('does not trust arbitrary x-forwarded-for as a limiter identity', () => {
    const spoof = (ip: string) =>
      new Request('http://localhost/api/now', { headers: { 'x-forwarded-for': ip } });

    for (let index = 0; index < 12; index += 1) {
      expect(consumeNowClientRateLimit(spoof(`198.51.100.${index}`), 1_000).allowed).toBe(true);
    }
    expect(consumeNowClientRateLimit(spoof('198.51.100.250'), 1_000).allowed).toBe(false);
  });

  it('hard-caps tracked identities by evicting the oldest entry', () => {
    for (let index = 0; index < 5001; index += 1) {
      expect(consumeNowClientRateLimit(requestFor(`2001:db8::${index}`), 1_000).allowed).toBe(true);
    }

    // The first identity was evicted when the hard cap was reached, so it gets a
    // fresh bucket instead of growing the map beyond its fixed maximum.
    expect(consumeNowClientRateLimit(requestFor('2001:db8::0'), 1_000).allowed).toBe(true);
  });
});
