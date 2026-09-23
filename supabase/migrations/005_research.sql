-- Server-owned research inbox. Public pages read it through /api/research-feed,
-- which selects only reviewed, current rows. Provider responses and judgments
-- are never directly exposed through Supabase's client roles.
create table if not exists public.meridian_research_items (
  id text primary key,
  destination_slug text,
  topic text not null,
  category text not null check (category in ('article', 'social', 'deal', 'flight')),
  source text not null check (source in ('exa', 'treg')),
  platform text not null,
  title text not null,
  excerpt text not null,
  url text not null,
  author text,
  published_at timestamptz,
  fetched_at timestamptz not null,
  reviewed_at timestamptz not null,
  decision text not null check (decision in ('publish', 'review', 'reject')),
  score real,
  confidence real,
  reasons jsonb not null default '[]'::jsonb,
  constraint meridian_research_published_requires_date
    check (decision <> 'publish' or published_at is not null),
  constraint meridian_research_score_range
    check (score is null or score between 0 and 100),
  constraint meridian_research_confidence_range
    check (confidence is null or confidence between 0 and 1)
);

create index if not exists meridian_research_feed_idx
  on public.meridian_research_items (decision, published_at desc);
create index if not exists meridian_research_destination_idx
  on public.meridian_research_items (destination_slug, decision, published_at desc);

alter table public.meridian_research_items enable row level security;
revoke all on public.meridian_research_items from public, anon, authenticated;
grant all on public.meridian_research_items to service_role;

-- Atomic, cross-instance cap: at most two paid sweeps in any rolling 24 hours
-- and at least eight hours between starts. window_started_at stores the oldest
-- still-counted claim; last_started_at stores the newest. Claims are kept after
-- partial failure so an outage cannot produce unlimited vendor retries.
create table if not exists public.meridian_research_control (
  name text primary key,
  window_started_at timestamptz not null,
  runs_in_window integer not null default 0 check (runs_in_window between 0 and 2),
  last_started_at timestamptz,
  last_completed_at timestamptz,
  last_status text,
  last_published integer not null default 0,
  last_review integer not null default 0,
  last_rejected integer not null default 0
);

alter table public.meridian_research_control enable row level security;
revoke all on public.meridian_research_control from public, anon, authenticated;
grant all on public.meridian_research_control to service_role;

create or replace function public.claim_meridian_research_run()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claim_time timestamptz;
  run_state public.meridian_research_control%rowtype;
begin
  insert into public.meridian_research_control(name, window_started_at)
  values ('global', clock_timestamp())
  on conflict (name) do nothing;

  select * into run_state
  from public.meridian_research_control
  where name = 'global'
  for update;

  -- Read the time after acquiring the row lock so competing instances use
  -- their actual admission order, including any wait for another claim.
  claim_time := clock_timestamp();

  if run_state.last_started_at is not null
     and run_state.last_started_at > claim_time - interval '8 hours' then
    return false;
  end if;

  -- Neither recorded claim remains in the rolling window.
  if run_state.last_started_at is null
     or run_state.last_started_at <= claim_time - interval '24 hours' then
    update public.meridian_research_control
    set window_started_at = claim_time,
        runs_in_window = 1,
        last_started_at = claim_time,
        last_status = 'running'
    where name = 'global';
    return true;
  end if;

  -- Exactly one claim is still inside the window.
  if run_state.runs_in_window = 1 then
    update public.meridian_research_control
    set window_started_at = run_state.last_started_at,
        runs_in_window = 2,
        last_started_at = claim_time,
        last_status = 'running'
    where name = 'global';
    return true;
  end if;

  -- Two claims were recorded. Admit a new one only after the older claim
  -- expires, carrying the newer claim forward as the oldest live claim.
  if run_state.window_started_at > claim_time - interval '24 hours' then
    return false;
  end if;

  update public.meridian_research_control
  set window_started_at = run_state.last_started_at,
      runs_in_window = 2,
      last_started_at = claim_time,
      last_status = 'running'
  where name = 'global';
  return true;
end;
$$;

revoke all on function public.claim_meridian_research_run() from public, anon, authenticated;
grant execute on function public.claim_meridian_research_run() to service_role;
