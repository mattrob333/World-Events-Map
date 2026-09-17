-- MERIDIAN traveler connections.
--
-- Connections represent person-to-person social relationships. They are
-- intentionally separate from Circle membership, follows, and Travel Modes.

create table public.profile_connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);

create unique index profile_connections_pair_unique
on public.profile_connections(
  least(requester_id, addressee_id),
  greatest(requester_id, addressee_id)
);

create index profile_connections_requester
on public.profile_connections(requester_id, status, updated_at desc);

create index profile_connections_addressee
on public.profile_connections(addressee_id, status, updated_at desc);

create function public.guard_profile_connection()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if TG_OP = 'UPDATE' then
    if new.requester_id <> old.requester_id or new.addressee_id <> old.addressee_id then
      raise exception 'Connection participants cannot change';
    end if;
    if old.status <> 'pending' and new.status <> old.status then
      raise exception 'Only pending connection requests can change status';
    end if;
    if old.status = 'pending' and new.status not in ('accepted','declined') then
      raise exception 'Pending connection requests can only be accepted or declined';
    end if;
    new.updated_at := now();
  end if;
  return new;
end
$$;

create trigger guard_profile_connection
before update on public.profile_connections
for each row execute function public.guard_profile_connection();

alter table public.profile_connections enable row level security;

create policy profile_connections_read
on public.profile_connections
for select
to authenticated
using (requester_id = auth.uid() or addressee_id = auth.uid());

create policy profile_connections_request
on public.profile_connections
for insert
to authenticated
with check (
  requester_id = auth.uid()
  and addressee_id <> auth.uid()
  and status = 'pending'
);

create policy profile_connections_respond
on public.profile_connections
for update
to authenticated
using (addressee_id = auth.uid() and status = 'pending')
with check (addressee_id = auth.uid());

create policy profile_connections_remove
on public.profile_connections
for delete
to authenticated
using (requester_id = auth.uid() or addressee_id = auth.uid());

grant select,insert,update,delete on public.profile_connections to authenticated;
