-- Durable, cross-instance spend guard for MERIDIAN NOW paid providers.
--
-- The NOW route can scale across many Vercel/server instances, so a process-local
-- counter cannot honestly be described as a global provider budget. This table
-- and function serialize claims in Postgres so every instance shares one cap.

create table if not exists public.meridian_now_provider_budget (
  name text primary key,
  window_started_at timestamptz not null,
  call_count integer not null default 0 check (call_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.meridian_now_provider_budget enable row level security;
revoke all on public.meridian_now_provider_budget from public, anon, authenticated;
grant all on public.meridian_now_provider_budget to service_role;

create or replace function public.claim_meridian_now_provider_budget()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  budget_name constant text := 'global';
  max_calls constant integer := 120;
  window_length constant interval := interval '10 minutes';
  claim_time timestamptz := clock_timestamp();
  started_at timestamptz;
  current_count integer;
  reset_at timestamptz;
  retry_seconds integer;
begin
  insert into public.meridian_now_provider_budget(
    name,
    window_started_at,
    call_count,
    updated_at
  )
  values (budget_name, claim_time, 0, claim_time)
  on conflict (name) do nothing;

  select window_started_at, call_count
  into started_at, current_count
  from public.meridian_now_provider_budget
  where name = budget_name
  for update;

  reset_at := started_at + window_length;

  if reset_at <= claim_time then
    update public.meridian_now_provider_budget
    set window_started_at = claim_time,
        call_count = 1,
        updated_at = claim_time
    where name = budget_name;

    return jsonb_build_object(
      'allowed', true,
      'retry_after_seconds', 0,
      'remaining', max_calls - 1
    );
  end if;

  if current_count >= max_calls then
    retry_seconds := greatest(
      1,
      ceil(extract(epoch from (reset_at - claim_time)))::integer
    );

    return jsonb_build_object(
      'allowed', false,
      'retry_after_seconds', retry_seconds,
      'remaining', 0
    );
  end if;

  current_count := current_count + 1;
  update public.meridian_now_provider_budget
  set call_count = current_count,
      updated_at = claim_time
  where name = budget_name;

  return jsonb_build_object(
    'allowed', true,
    'retry_after_seconds', 0,
    'remaining', greatest(0, max_calls - current_count)
  );
end;
$$;

revoke all on function public.claim_meridian_now_provider_budget() from public, anon, authenticated;
grant execute on function public.claim_meridian_now_provider_budget() to service_role;
