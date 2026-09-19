-- MERIDIAN first-class traveler identity.
--
-- A Profile is the canonical person-level social identity. Travel Modes remain
-- separate contextual identities and Circles remain trip memberships. This
-- migration adds safe profile customization plus a sanitized public RPC so
-- anonymous profile pages never gain direct access to private profile columns.

alter table public.profiles
  add column handle text,
  add column tagline text not null default '' check (length(tagline) <= 160),
  add column avatar_url text not null default '' check (avatar_url = '' or avatar_url ~ '^https://'),
  add column hero_url text not null default '' check (hero_url = '' or hero_url ~ '^https://'),
  add column theme_variant text not null default 'midnight'
    check (theme_variant in ('midnight','atlas','alpine')),
  add column theme_accent text not null default 'gold'
    check (theme_accent in ('gold','teal','ember','violet','ice','rose')),
  add column module_order text[] not null default array['travel_modes','interests','places','links']::text[],
  add column show_home_city boolean not null default true,
  add column show_home_airport boolean not null default false,
  add column updated_at timestamptz not null default now();

alter table public.travel_modes
  add column is_featured boolean not null default false;

create unique index profiles_handle_unique
on public.profiles(handle)
where handle is not null;

create function public.guard_profile_identity()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  allowed_modules constant text[] := array['travel_modes','interests','places','links'];
  cleaned_handle text;
  current_module text;
begin
  if new.handle is not null then
    cleaned_handle := lower(trim(new.handle));
    if cleaned_handle = '' then
      new.handle := null;
    else
      if cleaned_handle !~ '^[a-z0-9][a-z0-9_-]{2,29}$' then
        raise exception 'Profile handle must be 3-30 lowercase letters, numbers, underscores, or hyphens';
      end if;
      if cleaned_handle = any(array[
        'admin','api','account','community','constellation','events','help','login',
        'meridian','now','partners','people','profile','settings','support'
      ]) then
        raise exception 'That profile handle is reserved';
      end if;
      new.handle := cleaned_handle;
    end if;
  end if;

  if cardinality(new.module_order) > cardinality(allowed_modules) then
    raise exception 'Profile module order contains too many entries';
  end if;

  if (
    select count(*)
    from unnest(new.module_order) as modules(value)
  ) <> (
    select count(distinct value)
    from unnest(new.module_order) as modules(value)
  ) then
    raise exception 'Profile module order cannot contain duplicates';
  end if;

  foreach current_module in array new.module_order loop
    if not (current_module = any(allowed_modules)) then
      raise exception 'Unknown profile module: %', current_module;
    end if;
  end loop;

  new.updated_at := now();
  return new;
end
$$;

create trigger guard_profile_identity
before insert or update on public.profiles
for each row execute function public.guard_profile_identity();

create table public.profile_links (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('instagram','youtube','website','other')),
  label text not null default '' check (length(label) <= 60),
  url text not null check (url ~ '^https://'),
  visibility text not null default 'public' check (visibility in ('public','private')),
  sort_order smallint not null default 0 check (sort_order between 0 and 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profile_places (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 120),
  place_type text not null default 'other'
    check (place_type in ('city','venue','resort','region','other')),
  location_label text not null default '' check (length(location_label) <= 160),
  note text not null default '' check (length(note) <= 300),
  visibility text not null default 'public' check (visibility in ('public','private')),
  sort_order smallint not null default 0 check (sort_order between 0 and 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.touch_profile_child()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger touch_profile_links
before update on public.profile_links
for each row execute function public.touch_profile_child();

create trigger touch_profile_places
before update on public.profile_places
for each row execute function public.touch_profile_child();

alter table public.profile_links enable row level security;
alter table public.profile_places enable row level security;

create policy profile_links_read
on public.profile_links
for select
to authenticated
using (
  profile_id = auth.uid()
  or (
    visibility = 'public'
    and public.can_read_profile(profile_id)
  )
);

create policy profile_links_write
on public.profile_links
for all
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy profile_places_read
on public.profile_places
for select
to authenticated
using (
  profile_id = auth.uid()
  or (
    visibility = 'public'
    and public.can_read_profile(profile_id)
  )
);

create policy profile_places_write
on public.profile_places
for all
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create index profile_links_profile on public.profile_links(profile_id, sort_order, created_at);
create index profile_places_profile on public.profile_places(profile_id, sort_order, created_at);
create index travel_modes_featured on public.travel_modes(user_id, is_featured, updated_at desc);

-- Sanitized public-profile payload. Anonymous callers can execute this function
-- but never receive SELECT permission on the base profile tables.
create function public.get_public_traveler_profile(p_handle text)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  owner_id uuid;
  payload jsonb;
begin
  select p.id
  into owner_id
  from public.profiles p
  where p.handle = lower(trim(p_handle))
    and p.is_public = true
  limit 1;

  if owner_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'id', p.id,
    'handle', p.handle,
    'display_name', p.display_name,
    'tagline', p.tagline,
    'bio', p.bio,
    'avatar_url', p.avatar_url,
    'hero_url', p.hero_url,
    'theme_variant', p.theme_variant,
    'theme_accent', p.theme_accent,
    'module_order', p.module_order,
    'home_city', case when p.show_home_city then p.home_city else '' end,
    'home_airport', case when p.show_home_airport then p.home_airport else '' end,
    'interests', p.interests,
    'links', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id,
        'kind', l.kind,
        'label', l.label,
        'url', l.url
      ) order by l.sort_order, l.created_at)
      from public.profile_links l
      where l.profile_id = p.id and l.visibility = 'public'
    ), '[]'::jsonb),
    'places', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pl.id,
        'name', pl.name,
        'place_type', pl.place_type,
        'location_label', pl.location_label,
        'note', pl.note
      ) order by pl.sort_order, pl.created_at)
      from public.profile_places pl
      where pl.profile_id = p.id and pl.visibility = 'public'
    ), '[]'::jsonb),
    'travel_modes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'name', m.name,
        'description', m.description,
        'party_type', m.party_type,
        'destination', m.destination,
        'interests', coalesce((
          select jsonb_agg(jsonb_build_object('name', mi.interest, 'weight', mi.weight) order by mi.weight desc, mi.interest)
          from public.travel_mode_interests mi
          where mi.mode_id = m.id
        ), '[]'::jsonb)
      ) order by m.updated_at desc)
      from public.travel_modes m
      where m.user_id = p.id
        and m.visibility = 'discoverable'
        and m.is_featured = true
    ), '[]'::jsonb)
  )
  into payload
  from public.profiles p
  where p.id = owner_id;

  return payload;
end
$$;

revoke all on function public.get_public_traveler_profile(text) from public;
grant execute on function public.get_public_traveler_profile(text) to anon, authenticated;

grant select,insert,update,delete on public.profile_links, public.profile_places to authenticated;
