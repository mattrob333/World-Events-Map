-- Traveler (Vibe) profiles saved to a member's account, so they follow the
-- member across devices. Opt-in: the member turns it on in Settings; until
-- then (and after they turn it off) profiles live only in the browser.
--
-- What is stored: the profile the member built (name, home city, family
-- names and ages, tastes, listening summary, travel style), its label and
-- when it last changed. Only the owner can read or write their rows; nobody
-- else, including other members, ever sees them. Turning it off deletes them.
--
-- Deletions are kept briefly as tombstones (deleted = true, data emptied) so
-- removing a profile on one device removes it on the others too.

create table if not exists public.traveler_profiles (
  user_id uuid not null references auth.users on delete cascade,
  local_id text not null check (local_id ~ '^[A-Za-z0-9_-]{1,80}$'),
  label text check (label is null or length(label) <= 24),
  engine text not null default 'on-device' check (length(engine) <= 20),
  data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 100000),
  deleted boolean not null default false,
  updated_at timestamptz not null,
  primary key (user_id, local_id),
  check (not deleted or data = '{}'::jsonb)
);

alter table public.traveler_profiles enable row level security;
revoke all on public.traveler_profiles from public, anon, authenticated;
grant select, insert, update, delete on public.traveler_profiles to authenticated;
grant all on public.traveler_profiles to service_role;

create policy traveler_profiles_read on public.traveler_profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy traveler_profiles_insert on public.traveler_profiles
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy traveler_profiles_update on public.traveler_profiles
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy traveler_profiles_delete on public.traveler_profiles
  for delete to authenticated using (user_id = (select auth.uid()));

-- Before each write, for the member's own rows only (anything else is left to
-- RLS to reject, so this can't tell anyone about another member's rows):
--  * a timestamp from a fast clock is pulled back to now (+5 minutes of slack),
--    so one device can't win every future merge;
--  * an update older than what's stored is skipped, so a slow device can't
--    overwrite a newer edit;
--  * at most 40 live profiles per member (checked on insert and when a
--    tombstone comes back to life) and 200 rows in all, tombstones included;
--    tombstones older than 30 days are cleared.
create or replace function public.guard_traveler_profile()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.user_id is distinct from (select auth.uid()) then
    return new;
  end if;
  new.updated_at := least(new.updated_at, now() + interval '5 minutes');

  if tg_op = 'UPDATE' then
    if new.updated_at < old.updated_at then
      return null;
    end if;
    if old.deleted and not new.deleted then
      perform pg_advisory_xact_lock(hashtext('traveler_profiles:' || new.user_id::text));
      if (select count(*) from public.traveler_profiles where user_id = new.user_id and not deleted) >= 40 then
        raise exception 'Too many saved traveler profiles';
      end if;
    end if;
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('traveler_profiles:' || new.user_id::text));
  delete from public.traveler_profiles
  where user_id = new.user_id and deleted and updated_at < now() - interval '30 days';
  if not exists (select 1 from public.traveler_profiles where user_id = new.user_id and local_id = new.local_id) then
    if (select count(*) from public.traveler_profiles where user_id = new.user_id) >= 200
       or (not new.deleted and (select count(*) from public.traveler_profiles where user_id = new.user_id and not deleted) >= 40) then
      raise exception 'Too many saved traveler profiles';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_traveler_profile() from public, anon, authenticated;

drop trigger if exists guard_traveler_profile on public.traveler_profiles;
create trigger guard_traveler_profile
  before insert or update on public.traveler_profiles
  for each row execute function public.guard_traveler_profile();
