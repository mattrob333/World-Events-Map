import 'server-only';

import { createClient } from '@supabase/supabase-js';

type BudgetClaim = {
  allowed: boolean;
  retry_after_seconds: number;
  remaining: number;
};

export class NowProviderBudgetExceededError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super('NOW paid-provider budget is temporarily exhausted.');
    this.name = 'NowProviderBudgetExceededError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class NowProviderBudgetUnavailableError extends Error {
  constructor(message = 'NOW durable provider budget is unavailable.') {
    super(message);
    this.name = 'NowProviderBudgetUnavailableError';
  }
}

function isBudgetClaim(value: unknown): value is BudgetClaim {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const claim = value as Record<string, unknown>;
  return (
    typeof claim.allowed === 'boolean' &&
    typeof claim.retry_after_seconds === 'number' &&
    Number.isFinite(claim.retry_after_seconds) &&
    typeof claim.remaining === 'number' &&
    Number.isFinite(claim.remaining)
  );
}

/**
 * Atomically claim one unit of dope.travel's shared outbound-provider budget.
 *
 * This is intentionally durable and cross-instance. If Supabase/service-role
 * access or migration 004 is unavailable, paid provider work fails closed
 * rather than silently falling back to an unbounded process-local counter.
 */
export async function requireNowProviderBudget(): Promise<BudgetClaim> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new NowProviderBudgetUnavailableError(
      'NOW durable provider budget requires Supabase service-role configuration.',
    );
  }

  const db = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.rpc('claim_meridian_now_provider_budget');

  if (error || !isBudgetClaim(data)) {
    throw new NowProviderBudgetUnavailableError(
      'NOW durable provider budget could not be claimed; apply migration 004_now_provider_budget.sql.',
    );
  }

  if (!data.allowed) {
    throw new NowProviderBudgetExceededError(
      Math.max(1, Math.ceil(data.retry_after_seconds)),
    );
  }

  return data;
}
