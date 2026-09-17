-- Public traveler directory for MERIDIAN identity discovery.
-- Anonymous callers receive only explicitly public summary fields through this
-- RPC and still have no direct SELECT access to the profile tables.

create function public.list_public_traveler_profiles(p_limit integer default 40)
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  with visible as (
    select p.*
    from public.profiles p
    where p.is_public = true
      and p.handle is not null
    order by p.updated_at desc
    limit greatest(1, least(coalesce(p_limit, 40), 100))
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'handle', p.handle,
        'display_name', p.display_name,
        'tagline', p.tagline,
        'avatar_url', p.avatar_url,
        'hero_url', p.hero_url,
        'theme_accent', p.theme_accent,
        'home_city', case when p.show_home_city then p.home_city else '' end,
        'home_airport', case when p.show_home_airport then p.home_airport else '' end,
        'interests', p.interests,
        'featured_modes', coalesce((
          select jsonb_agg(m.name order by m.updated_at desc)
          from public.travel_modes m
          where m.user_id = p.id
            and m.visibility = 'discoverable'
            and m.is_featured = true
        ), '[]'::jsonb)
      )
      order by p.updated_at desc
    ),
    '[]'::jsonb
  )
  from visible p;
$$;

revoke all on function public.list_public_traveler_profiles(integer) from public;
grant execute on function public.list_public_traveler_profiles(integer) to anon, authenticated;
