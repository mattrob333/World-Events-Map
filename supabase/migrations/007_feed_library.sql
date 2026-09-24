-- Source library intake and Jev decision receipts. Server-only: the service
-- role writes and reads these; client roles get nothing.

create table if not exists public.meridian_feed_items (
  id text primary key,
  source_name text not null,
  source_feed text not null,
  source_tier text not null check (source_tier in ('A', 'B', 'C')),
  source_trip_types text[] not null default '{}',
  source_regions text[] not null default '{}',
  url text not null check (url ~ '^https?://'),
  title text not null check (length(title) between 1 and 300),
  -- Link plus a short quote only; never full text.
  excerpt text not null default '' check (length(excerpt) <= 260),
  published_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  contract text,
  jev_route text check (jev_route in ('reject', 'review', 'personal', 'public', 'unscored')),
  jev_trip_type text,
  jev_region text,
  jev_relevance real check (jev_relevance is null or jev_relevance between 0 and 1),
  jev_newsworthy real check (jev_newsworthy is null or jev_newsworthy between 0 and 3)
);
create index if not exists meridian_feed_items_recent on public.meridian_feed_items (published_at desc);
create index if not exists meridian_feed_items_route on public.meridian_feed_items (jev_route, published_at desc);
alter table public.meridian_feed_items enable row level security;
revoke all on public.meridian_feed_items from public, anon, authenticated;
grant all on public.meridian_feed_items to service_role;

-- Every Jev decision, acted on or not: contract version, state hash, the full
-- answers (distributions included), the route code chose, and a slot for a
-- human label so calibration can be measured before automation.
create table if not exists public.jev_decisions (
  id bigint generated always as identity primary key,
  contract text not null,
  subject text not null,
  state_hash text not null,
  model text,
  latency_ms integer not null default 0 check (latency_ms >= 0),
  answers jsonb,
  failure text,
  route text not null,
  action_taken boolean not null default false,
  human_label text,
  labeled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists jev_decisions_contract on public.jev_decisions (contract, created_at desc);
create index if not exists jev_decisions_subject on public.jev_decisions (subject);
alter table public.jev_decisions enable row level security;
revoke all on public.jev_decisions from public, anon, authenticated;
grant all on public.jev_decisions to service_role;

-- One intake run per 20 hours across all instances.
create table if not exists public.meridian_feed_control (
  name text primary key,
  last_started_at timestamptz,
  last_status text,
  last_counts jsonb not null default '{}'::jsonb
);
alter table public.meridian_feed_control enable row level security;
revoke all on public.meridian_feed_control from public, anon, authenticated;
grant all on public.meridian_feed_control to service_role;

create or replace function public.claim_meridian_feed_run()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare claimed integer;
begin
  insert into public.meridian_feed_control(name) values ('global') on conflict (name) do nothing;
  update public.meridian_feed_control
  set last_started_at = clock_timestamp(), last_status = 'running'
  where name = 'global'
    and (last_started_at is null or last_started_at <= clock_timestamp() - interval '20 hours');
  get diagnostics claimed = row_count;
  return claimed = 1;
end;
$$;
revoke all on function public.claim_meridian_feed_run() from public, anon, authenticated;
grant execute on function public.claim_meridian_feed_run() to service_role;
