-- Groups, trips (with their votes) and "which one is me" saved to a member's
-- account, alongside the traveler profiles of migration 009, so the You tab
-- and a trip in progress follow the member across devices. Same opt-in: the
-- member turns account saving on (Settings, or the one-time prompt after
-- sign-in); until then, and after they turn it off, all of it stays in the
-- browser.
--
-- What is stored, per kind:
--   group: its name, who is in it (profile ids) and guests added from a link
--          (travel cards: name, home city, loves, a kid flag; never ages).
--   trip:  the trip draft, everyone's votes, and who this device is on it.
--   you:   one row: which profile is the member, the group being planned
--          for, and which trips are open.
-- Only the owner can read or write their rows. Turning saving off deletes them.
--
-- Deletions are kept briefly as tombstones (deleted = true, data emptied) so
-- removing something on one device removes it on the others too.

create table if not exists public.traveler_state (
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('group', 'trip', 'you')),
  local_id text not null check (local_id ~ '^[A-Za-z0-9_-]{1,80}$'),
  data jsonb not null default '{}'::jsonb
    check (jsonb_typeof(data) = 'object'),
  deleted boolean not null default false,
  updated_at timestamptz not null,
  primary key (user_id, kind, local_id),
  check (not deleted or data = '{}'::jsonb),
  -- A trip carries its cards and votes; groups and the "you" row are small.
  check (octet_length(data::text) <= case kind when 'trip' then 400000 else 50000 end),
  check (kind <> 'you' or local_id = 'you')
);

alter table public.traveler_state enable row level security;
revoke all on public.traveler_state from public, anon, authenticated;
grant select, insert, update, delete on public.traveler_state to authenticated;
grant all on public.traveler_state to service_role;

create policy traveler_state_read on public.traveler_state
  for select to authenticated using (user_id = (select auth.uid()));
create policy traveler_state_insert on public.traveler_state
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy traveler_state_update on public.traveler_state
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy traveler_state_delete on public.traveler_state
  for delete to authenticated using (user_id = (select auth.uid()));

-- Before each write, for the member's own rows only (anything else is left to
-- RLS to reject), the same rules as traveler profiles:
--  * a timestamp from a fast clock is pulled back to now (+5 minutes);
--  * an update older than what's stored is skipped;
--  * live rows are capped per kind (40 groups, 20 trips) and 300 rows in all,
--    tombstones included; tombstones older than 30 days are cleared.
create or replace function public.guard_traveler_state()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  live_cap integer := case new.kind when 'group' then 40 when 'trip' then 20 else 1 end;
begin
  if new.user_id is distinct from (select auth.uid()) then
    return new;
  end if;
  new.updated_at := least(new.updated_at, now() + interval '5 minutes');

  if tg_op = 'UPDATE' then
    if new.updated_at < old.updated_at then
      return null;
    end if;
    if new.kind is distinct from old.kind or new.local_id is distinct from old.local_id then
      raise exception 'A saved item can''t change what it is';
    end if;
    if old.deleted and not new.deleted then
      perform pg_advisory_xact_lock(hashtext('traveler_state:' || new.user_id::text));
      if (select count(*) from public.traveler_state where user_id = new.user_id and kind = new.kind and not deleted) >= live_cap then
        raise exception 'Too many saved groups or trips';
      end if;
    end if;
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('traveler_state:' || new.user_id::text));
  delete from public.traveler_state
  where user_id = new.user_id and deleted and updated_at < now() - interval '30 days';
  if not exists (select 1 from public.traveler_state where user_id = new.user_id and kind = new.kind and local_id = new.local_id) then
    if (select count(*) from public.traveler_state where user_id = new.user_id) >= 300
       or (not new.deleted and (select count(*) from public.traveler_state where user_id = new.user_id and kind = new.kind and not deleted) >= live_cap) then
      raise exception 'Too many saved groups or trips';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_traveler_state() from public, anon, authenticated;

drop trigger if exists guard_traveler_state on public.traveler_state;
create trigger guard_traveler_state
  before insert or update on public.traveler_state
  for each row execute function public.guard_traveler_state();
