-- MERIDIAN affinity graph foundation.
-- Travel Modes let one member express different trip contexts without collapsing
-- them into one permanent profile identity.

alter table public.profiles
  add column if not exists home_airport text not null default ''
    check (home_airport = '' or home_airport ~ '^[A-Z0-9]{3,4}$');

alter table public.circles
  add column if not exists tags text[] not null default '{}',
  add column if not exists party_type text not null default 'mixed'
    check (party_type in ('solo','family','couple','friends','work','mixed'));

-- Circles are actionable trip plans. Unlike Travel Modes, which may be aspirational
-- and intentionally undated, a persisted Circle must always have a real date range.
-- Enforce this on new writes without assuming legacy rows are already complete.
create function public.guard_circle_dates()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if new.start_date is null or new.end_date is null then
    raise exception 'A travel circle requires both start and end dates';
  end if;
  if new.end_date < new.start_date then
    raise exception 'Circle end date must be on or after the start date';
  end if;
  return new;
end
$$;

create trigger guard_circle_dates
before insert or update of start_date,end_date on public.circles
for each row execute function public.guard_circle_dates();

create table public.travel_modes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null check (length(trim(name)) between 2 and 80),
  description text not null default '' check (length(description) <= 500),
  party_type text not null default 'solo'
    check (party_type in ('solo','family','couple','friends','work','mixed')),
  origin_city text not null default '' check (length(origin_city) <= 120),
  origin_airport text not null default ''
    check (origin_airport = '' or origin_airport ~ '^[A-Z0-9]{3,4}$'),
  destination text not null default '' check (length(destination) <= 120),
  start_date date,
  end_date date,
  visibility text not null default 'private'
    check (visibility in ('private','discoverable')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table public.travel_mode_interests (
  mode_id uuid not null references public.travel_modes on delete cascade,
  interest text not null check (length(trim(interest)) between 1 and 80),
  weight smallint not null default 3 check (weight between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (mode_id, interest)
);

create function public.can_read_travel_mode(mid uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from travel_modes m
    where m.id = mid
      and (
        m.user_id = auth.uid()
        or (
          m.visibility = 'discoverable'
          and public.can_read_profile(m.user_id)
        )
      )
  );
$$;

create function public.touch_travel_mode()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

create trigger touch_travel_mode
before update on public.travel_modes
for each row execute function public.touch_travel_mode();

alter table public.travel_modes enable row level security;
alter table public.travel_mode_interests enable row level security;

create policy travel_modes_read
on public.travel_modes
for select
to authenticated
using (
  user_id = auth.uid()
  or (
    visibility = 'discoverable'
    and public.can_read_profile(user_id)
  )
);

create policy travel_modes_insert
on public.travel_modes
for insert
to authenticated
with check (user_id = auth.uid());

create policy travel_modes_update
on public.travel_modes
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy travel_modes_delete
on public.travel_modes
for delete
to authenticated
using (user_id = auth.uid());

create policy travel_mode_interests_read
on public.travel_mode_interests
for select
to authenticated
using (public.can_read_travel_mode(mode_id));

create policy travel_mode_interests_insert
on public.travel_mode_interests
for insert
to authenticated
with check (
  exists (
    select 1 from public.travel_modes m
    where m.id = mode_id and m.user_id = auth.uid()
  )
);

create policy travel_mode_interests_update
on public.travel_mode_interests
for update
to authenticated
using (
  exists (
    select 1 from public.travel_modes m
    where m.id = mode_id and m.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.travel_modes m
    where m.id = mode_id and m.user_id = auth.uid()
  )
);

create policy travel_mode_interests_delete
on public.travel_mode_interests
for delete
to authenticated
using (
  exists (
    select 1 from public.travel_modes m
    where m.id = mode_id and m.user_id = auth.uid()
  )
);

create index travel_modes_user on public.travel_modes(user_id, updated_at desc);
create index travel_modes_discovery on public.travel_modes(visibility, party_type);
create index travel_mode_interests_interest on public.travel_mode_interests(lower(interest));
create index circles_affinity on public.circles(party_type, start_date, end_date);

revoke all on function public.can_read_travel_mode(uuid) from public;
grant execute on function public.can_read_travel_mode(uuid) to authenticated;

grant select,insert,update,delete on public.travel_modes to authenticated;
grant select,insert,update,delete on public.travel_mode_interests to authenticated;
