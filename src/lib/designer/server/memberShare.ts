import 'server-only';
import { memberPool } from '@/lib/now/liveBusyness';
import { dailyCap, type BudgetPool } from './dailyBudget';
import { refundSharedNamed, takeShared, takeSharedNamed } from './sharedBudget';

/**
 * One member's daily share of a paid provider, taken before the site-wide
 * pool, so a single account can't switch a feature off for everyone else.
 * Both are durable (migration 008); the member's share is given back when the
 * site pool then says no, since that call never went ahead.
 */
export type MemberSharePool = Extract<BudgetPool, 'voice' | 'designerAi' | 'jev'>;

/** Ledger names are letters only: `prefix` plus the hashed member id. */
const SHARES: Record<MemberSharePool, { env: string; prefix: string }> = {
  voice: { env: 'VOICE_MEMBER_DAILY_SESSIONS', prefix: 'voiceM' },
  designerAi: { env: 'DESIGNER_AI_MEMBER_DAILY_CALLS', prefix: 'aiM' },
  jev: { env: 'JEV_MEMBER_DAILY_CALLS', prefix: 'jevM' },
};

/** The fewest calls a member gets by default, however small the site cap. */
const MIN_SHARE = 3;

/** A member's daily cap: the env var when set, else a fifth of the site cap (at least a few). */
export function memberDailyCap(pool: MemberSharePool): number {
  const raw = Number(process.env[SHARES[pool].env]);
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw);
  return Math.max(MIN_SHARE, Math.floor(dailyCap(pool) / 5));
}

export type MemberShareResult = 'granted' | 'member' | 'site';

/**
 * Takes `units` from the member's share and then the site pool, or nothing.
 * `member`: this member's share for today is used; `site`: the whole site is.
 */
export async function takeMemberShare(memberId: string, pool: MemberSharePool, units = 1): Promise<MemberShareResult> {
  const name = memberPool(memberId, SHARES[pool].prefix);
  if (!(await takeSharedNamed(name, memberDailyCap(pool), units))) return 'member';
  if (!(await takeShared(pool, units))) {
    await refundSharedNamed(name, units);
    return 'site';
  }
  return 'granted';
}
