-- Supabase advisor hardening after the first hosted apply (2026-09-24).
-- Behavior-preserving: no policy changes who can see or write a row.

-- Trigger functions are never meant to be called over /rest/v1/rpc. Triggers
-- fire without the caller holding EXECUTE, so revoking it only closes the RPC.
revoke all on function public.initialize_circle() from public, anon, authenticated;
revoke all on function public.guard_membership() from public, anon, authenticated;
revoke all on function public.initialize_profile() from public, anon, authenticated;

-- RLS predicates run as the querying role, so each keeps EXECUTE only for the
-- roles whose policies call it. owns_provider backs the anon-visible
-- offers_read and event_submissions_read policies; for anon it is always false.
revoke all on function public.is_circle_host(uuid) from public, anon;
revoke all on function public.is_circle_member(uuid) from public, anon;
revoke all on function public.can_read_profile(uuid) from public, anon;
revoke all on function public.owns_offer(uuid) from public, anon;
revoke all on function public.can_read_travel_mode(uuid) from public, anon;
revoke all on function public.owns_provider(uuid) from public;
grant execute on function public.is_circle_host(uuid) to authenticated;
grant execute on function public.is_circle_member(uuid) to authenticated;
grant execute on function public.can_read_profile(uuid) to authenticated;
grant execute on function public.owns_offer(uuid) to authenticated;
grant execute on function public.can_read_travel_mode(uuid) to authenticated;
grant execute on function public.owns_provider(uuid) to anon, authenticated;

-- Evaluate auth.uid() once per statement instead of once per row.
alter policy profiles_insert on public.profiles with check (id = (select auth.uid()));
alter policy profiles_update on public.profiles
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
alter policy saves_own on public.saved_events
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy circles_insert on public.circles with check (host_id = (select auth.uid()));
alter policy circles_update on public.circles
  using (host_id = (select auth.uid())) with check (host_id = (select auth.uid()));
alter policy circles_delete on public.circles using (host_id = (select auth.uid()));
alter policy members_read on public.circle_members
  using (user_id = (select auth.uid()) or public.is_circle_host(circle_id)
    or (status = 'accepted' and public.is_circle_member(circle_id)));
alter policy members_request on public.circle_members
  with check (user_id = (select auth.uid()) and status = 'pending');
alter policy members_leave on public.circle_members
  using ((user_id = (select auth.uid()) and not public.is_circle_host(circle_id))
    or (public.is_circle_host(circle_id) and user_id <> (select auth.uid())));
alter policy messages_send on public.circle_messages
  with check (user_id = (select auth.uid()) and public.is_circle_member(circle_id));
alter policy providers_read on public.provider_orgs
  using (status = 'approved' or owner_id = (select auth.uid()));
alter policy providers_apply on public.provider_orgs
  with check (owner_id = (select auth.uid()) and status = 'pending');
alter policy providers_edit on public.provider_orgs
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
alter policy inquiries_read on public.inquiries
  using (traveler_id = (select auth.uid()) or public.owns_offer(offer_id));
alter policy inquiries_insert on public.inquiries
  with check (traveler_id = (select auth.uid()) and status = 'new' and response = ''
    and exists (select 1 from public.offers where id = offer_id and status = 'published' and expires_at > now()));
alter policy travel_modes_read on public.travel_modes
  using (user_id = (select auth.uid())
    or (visibility = 'discoverable' and public.can_read_profile(user_id)));
alter policy travel_modes_insert on public.travel_modes with check (user_id = (select auth.uid()));
alter policy travel_modes_update on public.travel_modes
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy travel_modes_delete on public.travel_modes using (user_id = (select auth.uid()));
alter policy travel_mode_interests_insert on public.travel_mode_interests
  with check (exists (select 1 from public.travel_modes m
    where m.id = mode_id and m.user_id = (select auth.uid())));
alter policy travel_mode_interests_update on public.travel_mode_interests
  using (exists (select 1 from public.travel_modes m
    where m.id = mode_id and m.user_id = (select auth.uid())))
  with check (exists (select 1 from public.travel_modes m
    where m.id = mode_id and m.user_id = (select auth.uid())));
alter policy travel_mode_interests_delete on public.travel_mode_interests
  using (exists (select 1 from public.travel_modes m
    where m.id = mode_id and m.user_id = (select auth.uid())));

-- Cover foreign keys used by owner lookups and cascades.
create index if not exists circle_messages_user on public.circle_messages(user_id);
create index if not exists circles_host on public.circles(host_id);
create index if not exists event_submissions_provider on public.event_submissions(provider_id);
create index if not exists inquiries_traveler on public.inquiries(traveler_id);
create index if not exists offers_provider on public.offers(provider_id);
