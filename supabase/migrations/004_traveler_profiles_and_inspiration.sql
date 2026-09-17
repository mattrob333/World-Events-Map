-- MERIDIAN traveler identity + anticipation layer.
--
-- The profile is a first-class public artifact, not an auth settings form.
-- External media is stored as attributed URLs. MERIDIAN does not copy third-party
-- media into its own storage in this migration.

alter table public.profiles
  add column if not exists handle text not null default ''
    check (handle = '' or handle ~ '^[a-z0-9][a-z0-9_-]{2,29}$'),
  add column if not exists headline text not null default '' check (length(headline) <= 140),
  add column if not exists avatar_url text not null default ''
    check (avatar_url = '' or avatar_url ~ '^https://'),
  add column if not exists cover_url text not null default ''
    check (cover_url = '' or cover_url ~ '^https://'),
  add column if not exists profile_theme text not null default 'midnight'
    check (profile_theme in ('midnight','alpine','coastal','desert','city')),
  add column if not exists show_home_base boolean not null default true,
  add column if not exists show_travel_modes boolean not null default true,
  add column if not exists profile_updated_at timestamptz not null default now();

create unique index if not exists profiles_handle_unique
  on public.profiles (lower(handle))
  where handle <> '';

create function public.guard_profile_identity()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  new.handle := lower(trim(new.handle));
  new.profile_updated_at := now();
  if new.is_public and new.handle = '' then
    raise exception 'A public traveler profile requires a handle';
  end if;
  return new;
end
$$;

create trigger guard_profile_identity
before insert or update on public.profiles
for each row execute function public.guard_profile_identity();

create table public.profile_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('instagram','youtube','tiktok','website','other')),
  label text not null check (length(trim(label)) between 1 and 60),
  url text not null check (url ~ '^https://'),
  sort_order smallint not null default 0 check (sort_order between 0 and 100),
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profile_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('visited','favorite','bucket')),
  place_name text not null check (length(trim(place_name)) between 2 and 120),
  country_code text not null default '' check (country_code = '' or country_code ~ '^[A-Z]{2}$'),
  note text not null default '' check (length(note) <= 400),
  visited_on date,
  sort_order smallint not null default 0 check (sort_order between 0 and 100),
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.saved_content (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  provider text not null check (provider in ('youtube','instagram','tiktok','image','web','other')),
  url text not null check (url ~ '^https://'),
  title text not null default '' check (length(title) <= 180),
  note text not null default '' check (length(note) <= 1200),
  destination text not null default '' check (length(destination) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,url)
);

create table public.profile_content (
  user_id uuid not null references auth.users on delete cascade,
  content_id uuid not null references public.saved_content on delete cascade,
  sort_order smallint not null default 0 check (sort_order between 0 and 100),
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  primary key(user_id,content_id)
);

create table public.circle_content (
  circle_id uuid not null references public.circles on delete cascade,
  content_id uuid not null references public.saved_content on delete cascade,
  shared_by uuid not null references auth.users on delete cascade,
  caption text not null default '' check (length(caption) <= 800),
  created_at timestamptz not null default now(),
  primary key(circle_id,content_id)
);

create function public.touch_traveler_content()
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
for each row execute function public.touch_traveler_content();

create trigger touch_profile_places
before update on public.profile_places
for each row execute function public.touch_traveler_content();

create trigger touch_saved_content
before update on public.saved_content
for each row execute function public.touch_traveler_content();

create function public.can_read_saved_content(cid uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1 from saved_content s where s.id=cid and s.user_id=auth.uid()
  ) or exists(
    select 1 from circle_content cc
    where cc.content_id=cid and public.is_circle_member(cc.circle_id)
  );
$$;

alter table public.profile_links enable row level security;
alter table public.profile_places enable row level security;
alter table public.saved_content enable row level security;
alter table public.profile_content enable row level security;
alter table public.circle_content enable row level security;

create policy profile_links_owner
on public.profile_links for all to authenticated
using (user_id=auth.uid()) with check (user_id=auth.uid());

create policy profile_places_owner
on public.profile_places for all to authenticated
using (user_id=auth.uid()) with check (user_id=auth.uid());

create policy saved_content_read
on public.saved_content for select to authenticated
using (public.can_read_saved_content(id));

create policy saved_content_insert
on public.saved_content for insert to authenticated
with check (user_id=auth.uid());

create policy saved_content_update
on public.saved_content for update to authenticated
using (user_id=auth.uid()) with check (user_id=auth.uid());

create policy saved_content_delete
on public.saved_content for delete to authenticated
using (user_id=auth.uid());

create policy profile_content_owner
on public.profile_content for all to authenticated
using (user_id=auth.uid())
with check (
  user_id=auth.uid()
  and exists(select 1 from saved_content s where s.id=content_id and s.user_id=auth.uid())
);

create policy circle_content_read
on public.circle_content for select to authenticated
using (public.is_circle_member(circle_id));

create policy circle_content_insert
on public.circle_content for insert to authenticated
with check (
  shared_by=auth.uid()
  and public.is_circle_member(circle_id)
  and exists(select 1 from saved_content s where s.id=content_id and s.user_id=auth.uid())
);

create policy circle_content_update
on public.circle_content for update to authenticated
using (shared_by=auth.uid())
with check (
  shared_by=auth.uid()
  and public.is_circle_member(circle_id)
  and exists(select 1 from saved_content s where s.id=content_id and s.user_id=auth.uid())
);

create policy circle_content_delete
on public.circle_content for delete to authenticated
using (shared_by=auth.uid() or public.is_circle_host(circle_id));

create function public.pin_profile_content(
  content_url text,
  content_provider text,
  content_title text default '',
  content_note text default '',
  content_destination text default '',
  content_public boolean default true
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  uid uuid := auth.uid();
  cid uuid;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if content_url !~ '^https://' then raise exception 'Use an https URL'; end if;
  if content_provider not in ('youtube','instagram','tiktok','image','web','other') then
    raise exception 'Unsupported content provider';
  end if;

  insert into saved_content(user_id,provider,url,title,note,destination)
  values(uid,content_provider,content_url,left(content_title,180),left(content_note,1200),left(content_destination,120))
  on conflict(user_id,url) do update set
    provider=excluded.provider,
    title=excluded.title,
    note=excluded.note,
    destination=excluded.destination,
    updated_at=now()
  returning id into cid;

  insert into profile_content(user_id,content_id,is_public)
  values(uid,cid,content_public)
  on conflict(user_id,content_id) do update set is_public=excluded.is_public;

  return cid;
end
$$;

create function public.share_circle_content(
  target_circle uuid,
  content_url text,
  content_provider text,
  content_title text default '',
  content_note text default '',
  content_destination text default '',
  share_caption text default ''
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  uid uuid := auth.uid();
  cid uuid;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if not public.is_circle_member(target_circle) then raise exception 'Accepted circle membership required'; end if;
  if content_url !~ '^https://' then raise exception 'Use an https URL'; end if;
  if content_provider not in ('youtube','instagram','tiktok','image','web','other') then
    raise exception 'Unsupported content provider';
  end if;

  insert into saved_content(user_id,provider,url,title,note,destination)
  values(uid,content_provider,content_url,left(content_title,180),left(content_note,1200),left(content_destination,120))
  on conflict(user_id,url) do update set
    provider=excluded.provider,
    title=excluded.title,
    note=excluded.note,
    destination=excluded.destination,
    updated_at=now()
  returning id into cid;

  insert into circle_content(circle_id,content_id,shared_by,caption)
  values(target_circle,cid,uid,left(share_caption,800))
  on conflict(circle_id,content_id) do update set
    caption=excluded.caption,
    shared_by=excluded.shared_by;

  return cid;
end
$$;

-- Public profile snapshots are intentionally exposed through one narrow RPC.
-- The function returns only fields the product has chosen to make public and
-- applies the profile's granular visibility controls before returning data.
create function public.traveler_snapshot(profile_handle text)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  p profiles%rowtype;
  payload jsonb;
begin
  select * into p
  from profiles
  where lower(handle)=lower(trim(profile_handle)) and is_public=true
  limit 1;

  if not found then return null; end if;

  select jsonb_build_object(
    'profile', jsonb_build_object(
      'handle', p.handle,
      'display_name', p.display_name,
      'headline', p.headline,
      'bio', p.bio,
      'avatar_url', p.avatar_url,
      'cover_url', p.cover_url,
      'profile_theme', p.profile_theme,
      'home_city', case when p.show_home_base then p.home_city else '' end,
      'home_airport', case when p.show_home_base then p.home_airport else '' end,
      'interests', p.interests,
      'updated_at', p.profile_updated_at
    ),
    'links', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',l.id,'kind',l.kind,'label',l.label,'url',l.url
      ) order by l.sort_order,l.created_at)
      from profile_links l where l.user_id=p.id and l.is_public=true
    ), '[]'::jsonb),
    'places', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',pl.id,'kind',pl.kind,'place_name',pl.place_name,
        'country_code',pl.country_code,'note',pl.note,'visited_on',pl.visited_on
      ) order by pl.sort_order,pl.created_at)
      from profile_places pl where pl.user_id=p.id and pl.is_public=true
    ), '[]'::jsonb),
    'content', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',s.id,'provider',s.provider,'url',s.url,'title',s.title,
        'note',s.note,'destination',s.destination
      ) order by pc.sort_order,pc.created_at)
      from profile_content pc join saved_content s on s.id=pc.content_id
      where pc.user_id=p.id and pc.is_public=true
    ), '[]'::jsonb),
    'modes', case when p.show_travel_modes then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',m.id,'name',m.name,'description',m.description,
        'party_type',m.party_type,'origin_city',m.origin_city,
        'origin_airport',m.origin_airport,'destination',m.destination,
        'start_date',m.start_date,'end_date',m.end_date,
        'interests',coalesce((
          select jsonb_agg(jsonb_build_object('name',mi.interest,'weight',mi.weight) order by mi.weight desc,mi.interest)
          from travel_mode_interests mi where mi.mode_id=m.id
        ),'[]'::jsonb)
      ) order by m.updated_at desc)
      from travel_modes m where m.user_id=p.id and m.visibility='discoverable'
    ), '[]'::jsonb) else '[]'::jsonb end
  ) into payload;

  return payload;
end
$$;

create index profile_links_user on public.profile_links(user_id,sort_order,created_at);
create index profile_places_user on public.profile_places(user_id,kind,sort_order,created_at);
create index saved_content_user on public.saved_content(user_id,created_at desc);
create index circle_content_thread on public.circle_content(circle_id,created_at desc);

revoke all on function public.can_read_saved_content(uuid) from public;
revoke all on function public.pin_profile_content(text,text,text,text,text,boolean) from public;
revoke all on function public.share_circle_content(uuid,text,text,text,text,text,text) from public;
revoke all on function public.traveler_snapshot(text) from public;

grant execute on function public.can_read_saved_content(uuid) to authenticated;
grant execute on function public.pin_profile_content(text,text,text,text,text,boolean) to authenticated;
grant execute on function public.share_circle_content(uuid,text,text,text,text,text,text) to authenticated;
grant execute on function public.traveler_snapshot(text) to anon,authenticated;

grant select,insert,update,delete on public.profile_links to authenticated;
grant select,insert,update,delete on public.profile_places to authenticated;
grant select,insert,update,delete on public.saved_content to authenticated;
grant select,insert,update,delete on public.profile_content to authenticated;
grant select,insert,update,delete on public.circle_content to authenticated;
