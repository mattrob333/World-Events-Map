-- Durable, cross-instance daily caps for paid providers used by the designer,
-- voice, research and event routes (src/lib/designer/server/dailyBudget.ts).
--
-- The in-memory ledgers are per serverless instance, so the true worst case
-- was `cap x instances`. This table gives every instance one shared ledger per
-- pool per UTC day. Caps stay in code (env-configurable) and are passed in by
-- the server; only the service role can call these functions.
--
-- Units: calls for count pools, micro-USD for research pools.

create table if not exists public.meridian_daily_budget (
  pool text not null check (pool ~ '^[a-zA-Z]{1,40}$'),
  day date not null,
  spent bigint not null default 0 check (spent >= 0),
  updated_at timestamptz not null default now(),
  primary key (pool, day)
);

alter table public.meridian_daily_budget enable row level security;
revoke all on public.meridian_daily_budget from public, anon, authenticated;
grant all on public.meridian_daily_budget to service_role;

-- Claim `units` against today's (UTC) ledger for `pool`, only if the total stays
-- within `cap`. Atomic under concurrency: the conditional upsert takes the row
-- lock, so two claims can never together pass the cap. Returns the UTC day the
-- units were charged to (pass it back to refund), or null when refused.
create or replace function public.claim_meridian_daily_budget(p_pool text, p_units bigint, p_cap bigint)
returns date
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (clock_timestamp() at time zone 'utc')::date;
  granted bigint;
begin
  if p_pool is null or p_pool !~ '^[a-zA-Z]{1,40}$' then
    raise exception 'invalid pool';
  end if;
  if p_units is null or p_units <= 0 or p_cap is null or p_cap < 0 then
    raise exception 'invalid units or cap';
  end if;
  if p_units > p_cap then
    return null;
  end if;

  insert into public.meridian_daily_budget as b (pool, day, spent, updated_at)
  values (p_pool, today, p_units, clock_timestamp())
  on conflict (pool, day) do update
    set spent = b.spent + excluded.spent,
        updated_at = excluded.updated_at
    where b.spent + excluded.spent <= p_cap
  returning b.spent into granted;

  return case when granted is null then null else today end;
end;
$$;

-- Give back units that were claimed but not spent (a reservation settled for
-- less than its ceiling), on the day they were claimed. Never goes below zero,
-- and never touches another day's ledger: a refund can't free today's budget
-- with yesterday's reservation.
create or replace function public.refund_meridian_daily_budget(p_pool text, p_units bigint, p_day date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_pool is null or p_pool !~ '^[a-zA-Z]{1,40}$' or p_units is null or p_units <= 0 or p_day is null then
    return;
  end if;
  update public.meridian_daily_budget
  set spent = greatest(0, spent - p_units),
      updated_at = clock_timestamp()
  where pool = p_pool and day = p_day;
end;
$$;

revoke all on function public.claim_meridian_daily_budget(text, bigint, bigint) from public, anon, authenticated;
revoke all on function public.refund_meridian_daily_budget(text, bigint, date) from public, anon, authenticated;
grant execute on function public.claim_meridian_daily_budget(text, bigint, bigint) to service_role;
grant execute on function public.refund_meridian_daily_budget(text, bigint, date) to service_role;
