-- Server-owned cache shared by refresh workers and public calendar reads.
create table if not exists public.meridian_signal_snapshots (
  event_id text primary key,
  patch jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now()
);
alter table public.meridian_signal_snapshots enable row level security;
revoke all on public.meridian_signal_snapshots from anon, authenticated;
grant all on public.meridian_signal_snapshots to service_role;

-- Atomic cross-instance lease caps the scheduled worker to one batch per 10 minutes.
create table if not exists public.meridian_refresh_leases (
  name text primary key, expires_at timestamptz not null
);
alter table public.meridian_refresh_leases enable row level security;
revoke all on public.meridian_refresh_leases from anon, authenticated;
grant all on public.meridian_refresh_leases to service_role;
create or replace function public.claim_meridian_refresh() returns boolean
language plpgsql security definer set search_path = public as $$
declare claimed integer;
begin
  insert into public.meridian_refresh_leases(name, expires_at)
  values ('signals', now() + interval '10 minutes')
  on conflict (name) do update set expires_at = excluded.expires_at
  where meridian_refresh_leases.expires_at < now();
  get diagnostics claimed = row_count;
  return claimed = 1;
end;
$$;
revoke all on function public.claim_meridian_refresh() from public, anon, authenticated;
grant execute on function public.claim_meridian_refresh() to service_role;

create table if not exists public.meridian_scene_posts (
 event_id text primary key, posts jsonb not null default '[]'::jsonb,
 fetched_at timestamptz not null default now()
);
alter table public.meridian_scene_posts enable row level security;
revoke all on public.meridian_scene_posts from anon, authenticated;
grant all on public.meridian_scene_posts to service_role;
