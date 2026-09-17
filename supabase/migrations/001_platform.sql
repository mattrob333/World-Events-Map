-- MERIDIAN member and partner platform. Apply once using Supabase migrations.
create extension if not exists pgcrypto;
create table public.profiles (
 id uuid primary key references auth.users on delete cascade,
 display_name text not null default '' check (length(display_name)<=100),
 home_city text not null default '' check (length(home_city)<=120),
 interests text[] not null default '{}', bio text not null default '' check(length(bio)<=600),
 is_public boolean not null default false, created_at timestamptz not null default now()
);
create table public.saved_events (
 user_id uuid not null references auth.users on delete cascade, event_id text not null,
 created_at timestamptz not null default now(), primary key(user_id,event_id)
);
create table public.circles (
 id uuid primary key default gen_random_uuid(), host_id uuid not null references auth.users,
 event_id text, name text not null check(length(name) between 3 and 100),
 description text not null default '' check(length(description)<=2000),
 destination text not null default '', departure_city text not null default '',
 start_date date, end_date date, capacity integer not null default 8 check(capacity between 2 and 100),
 created_at timestamptz not null default now(), check(end_date is null or start_date is null or end_date>=start_date)
);
create table public.circle_members (
 circle_id uuid not null references public.circles on delete cascade,
 user_id uuid not null references auth.users on delete cascade,
 status text not null default 'pending' check(status in ('pending','accepted')),
 created_at timestamptz not null default now(), primary key(circle_id,user_id)
);
create table public.circle_messages (
 id uuid primary key default gen_random_uuid(), circle_id uuid not null references public.circles on delete cascade,
 user_id uuid not null references auth.users, body text not null check(length(trim(body)) between 1 and 3000),
 created_at timestamptz not null default now()
);
create table public.provider_orgs (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null unique references auth.users,
 name text not null check(length(trim(name)) between 2 and 120),
 category text not null check(category in ('hotel','chauffeur','aviation','organizer','advisor')),
 description text not null default '' check(length(description)<=2000),
 website text not null default '' check(website='' or website ~ '^https://'),
 status text not null default 'pending' check(status in ('pending','approved','suspended')),
 created_at timestamptz not null default now()
);
create table public.offers (
 id uuid primary key default gen_random_uuid(), provider_id uuid not null references public.provider_orgs on delete cascade,
 event_id text, destination text not null check(length(trim(destination)) between 2 and 120),
 title text not null check(length(trim(title)) between 3 and 140), description text not null check(length(trim(description)) between 10 and 3000),
 kind text not null check(kind in ('stay','arrive','access','curated')),
 price_label text not null default '' check(length(price_label)<=100),
 availability text not null default 'request' check(availability in ('request','provider_updated')),
 expires_at timestamptz not null, status text not null default 'draft' check(status in ('draft','published','paused')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.inquiries (
 id uuid primary key default gen_random_uuid(), offer_id uuid not null references public.offers,
 traveler_id uuid not null references auth.users, message text not null check(length(trim(message)) between 10 and 3000),
 status text not null default 'new' check(status in ('new','replied','closed')),
 response text not null default '' check(length(response)<=4000), created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
-- Security-definer predicates avoid recursive RLS while returning only a boolean.
create function public.is_circle_host(cid uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from circles where id=cid and host_id=auth.uid()); $$;
create function public.is_circle_member(cid uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from circle_members where circle_id=cid and user_id=auth.uid() and status='accepted'); $$;
create function public.owns_provider(pid uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from provider_orgs where id=pid and owner_id=auth.uid()); $$;
create function public.owns_offer(oid uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from offers o join provider_orgs p on p.id=o.provider_id where o.id=oid and p.owner_id=auth.uid()); $$;
create function public.can_read_profile(uid uuid) returns boolean language sql stable security definer set search_path=public as $$
 select uid=auth.uid() or exists(select 1 from profiles where id=uid and is_public) or exists(
 select 1 from circle_members m where m.user_id=uid and (public.is_circle_host(m.circle_id) or (m.status='accepted' and public.is_circle_member(m.circle_id)))); $$;
create function public.initialize_circle() returns trigger language plpgsql security definer set search_path=public as $$
 begin insert into circle_members(circle_id,user_id,status) values(new.id,new.host_id,'accepted'); return new; end $$;
create trigger initialize_circle after insert on public.circles for each row execute function public.initialize_circle();
-- Reject membership changes that exceed capacity; serialize accepts on the circle row.
create function public.guard_membership() returns trigger language plpgsql security definer set search_path=public as $$
 declare max_members integer;
 begin
  if TG_OP='UPDATE' and (new.circle_id<>old.circle_id or new.user_id<>old.user_id) then raise exception 'Membership identity cannot change'; end if;
  if new.status='accepted' and (TG_OP='INSERT' or old.status<>'accepted') then
   select capacity into max_members from circles where id=new.circle_id for update;
   if (select count(*) from circle_members where circle_id=new.circle_id and status='accepted')>=max_members then raise exception 'This circle is full'; end if;
  end if;
  return new;
 end $$;
create trigger guard_membership before insert or update on public.circle_members for each row execute function public.guard_membership();
create function public.guard_provider() returns trigger language plpgsql set search_path=public as $$
 begin
  if current_user in ('anon','authenticated') then
   if TG_OP='INSERT' and new.status<>'pending' then raise exception 'Provider approval requires an administrator'; end if;
   if TG_OP='UPDATE' and (new.status<>old.status or new.owner_id<>old.owner_id) then raise exception 'Provider approval requires an administrator'; end if;
  end if;
  return new;
 end $$;
create trigger guard_provider before insert or update on public.provider_orgs for each row execute function public.guard_provider();
create function public.guard_offer() returns trigger language plpgsql set search_path=public as $$
 begin
  if TG_OP='UPDATE' and new.provider_id<>old.provider_id then raise exception 'Offer provider cannot change'; end if;
  if new.status='published' and (new.expires_at<=now() or not exists(select 1 from provider_orgs where id=new.provider_id and status='approved')) then raise exception 'An approved provider and future expiry are required'; end if;
  new.updated_at=now(); return new;
 end $$;
create trigger guard_offer before insert or update on public.offers for each row execute function public.guard_offer();
create function public.guard_inquiry() returns trigger language plpgsql set search_path=public as $$
 begin
  if TG_OP='UPDATE' and (new.offer_id<>old.offer_id or new.traveler_id<>old.traveler_id or new.message<>old.message or new.created_at<>old.created_at) then raise exception 'Inquiry identity and original request cannot change'; end if;
  new.updated_at=now(); return new;
 end $$;
create trigger guard_inquiry before update on public.inquiries for each row execute function public.guard_inquiry();
alter table public.profiles enable row level security;
alter table public.saved_events enable row level security;
alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.circle_messages enable row level security;
alter table public.provider_orgs enable row level security;
alter table public.offers enable row level security;
alter table public.inquiries enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(public.can_read_profile(id));
create policy profiles_insert on public.profiles for insert to authenticated with check(id=auth.uid());
create policy profiles_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy saves_own on public.saved_events for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
-- Circles are discoverable by members; itinerary/chat remains within accepted membership.
create policy circles_read on public.circles for select to authenticated using(true);
create policy circles_insert on public.circles for insert to authenticated with check(host_id=auth.uid());
create policy circles_update on public.circles for update to authenticated using(host_id=auth.uid()) with check(host_id=auth.uid());
create policy circles_delete on public.circles for delete to authenticated using(host_id=auth.uid());
create policy members_read on public.circle_members for select to authenticated using(user_id=auth.uid() or public.is_circle_host(circle_id) or (status='accepted' and public.is_circle_member(circle_id)));
create policy members_request on public.circle_members for insert to authenticated with check(user_id=auth.uid() and status='pending');
create policy members_approve on public.circle_members for update to authenticated using(public.is_circle_host(circle_id)) with check(public.is_circle_host(circle_id));
create policy members_leave on public.circle_members for delete to authenticated using((user_id=auth.uid() and not public.is_circle_host(circle_id)) or (public.is_circle_host(circle_id) and user_id<>auth.uid()));
create policy messages_read on public.circle_messages for select to authenticated using(public.is_circle_member(circle_id));
create policy messages_send on public.circle_messages for insert to authenticated with check(user_id=auth.uid() and public.is_circle_member(circle_id));
create policy providers_read on public.provider_orgs for select using(status='approved' or owner_id=auth.uid());
create policy providers_apply on public.provider_orgs for insert to authenticated with check(owner_id=auth.uid() and status='pending');
create policy providers_edit on public.provider_orgs for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy offers_read on public.offers for select using(public.owns_provider(provider_id) or (status='published' and expires_at>now() and exists(select 1 from provider_orgs where id=provider_id and status='approved')));
create policy offers_insert on public.offers for insert to authenticated with check(public.owns_provider(provider_id));
create policy offers_update on public.offers for update to authenticated using(public.owns_provider(provider_id)) with check(public.owns_provider(provider_id));
create policy offers_delete on public.offers for delete to authenticated using(public.owns_provider(provider_id) and status='draft');
create policy inquiries_read on public.inquiries for select to authenticated using(traveler_id=auth.uid() or public.owns_offer(offer_id));
create policy inquiries_insert on public.inquiries for insert to authenticated with check(traveler_id=auth.uid() and status='new' and response='' and exists(select 1 from offers where id=offer_id and status='published' and expires_at>now()));
create policy inquiries_reply on public.inquiries for update to authenticated using(public.owns_offer(offer_id)) with check(public.owns_offer(offer_id));
create index circle_messages_thread on public.circle_messages(circle_id,created_at);
create index circle_members_user on public.circle_members(user_id);
create index offers_discovery on public.offers(status,expires_at);
create index inquiries_offer on public.inquiries(offer_id,created_at);
grant usage on schema public to anon,authenticated;
grant select on public.offers,public.provider_orgs to anon;
grant select,insert,update,delete on public.profiles,public.saved_events,public.circles,public.circle_members,public.circle_messages,public.provider_orgs,public.offers,public.inquiries to authenticated;
create function public.initialize_profile() returns trigger language plpgsql security definer set search_path=public as $$
 begin insert into profiles(id) values(new.id) on conflict do nothing; return new; end $$;
create trigger initialize_profile after insert on auth.users for each row execute function public.initialize_profile();
insert into public.profiles(id) select id from auth.users on conflict do nothing;
create table public.event_submissions (
 id uuid primary key default gen_random_uuid(), provider_id uuid not null references public.provider_orgs,
 name text not null check(length(trim(name)) between 3 and 140), description text not null check(length(trim(description)) between 10 and 3000),
 destination text not null check(length(trim(destination)) between 2 and 120), venue text not null default '',
 country text not null check(length(trim(country)) between 2 and 120), country_code text not null check(country_code ~ '^[A-Z]{2}$'), timezone text not null default 'UTC',
 category text not null, start_date date not null, end_date date not null, latitude double precision not null check(latitude between -90 and 90), longitude double precision not null check(longitude between -180 and 180),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(), check(end_date>=start_date)
);
alter table public.event_submissions enable row level security;
create policy event_submissions_read on public.event_submissions for select using(public.owns_provider(provider_id) or (status='approved' and exists(select 1 from provider_orgs where id=provider_id and status='approved')));
create policy event_submissions_insert on public.event_submissions for insert to authenticated with check(public.owns_provider(provider_id) and status='pending');
create policy event_submissions_delete on public.event_submissions for delete to authenticated using(public.owns_provider(provider_id) and status='pending');
grant select on public.event_submissions to anon;
grant select,insert,delete on public.event_submissions to authenticated;

create function public.guard_event_timezone() returns trigger language plpgsql set search_path=public as $$
 begin
  if not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'Use a valid IANA time zone'; end if;
  return new;
 end $$;
create trigger guard_event_timezone before insert or update on public.event_submissions for each row execute function public.guard_event_timezone();
