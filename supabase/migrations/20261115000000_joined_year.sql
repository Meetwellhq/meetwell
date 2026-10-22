-- Public cards show the year the member joined ("Joined 2026"). Only the year
-- is shared, taken from when the card was created (Lagos time).

create or replace function public.get_public_profile(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'slug', p.slug,
    'fullName', p.full_name,
    'avatarUrl', p.avatar_url,
    'title', p.professional_title,
    'organization', p.organization,
    'bio', p.bio,
    'websiteUrl', case when p.website_is_public then p.website_url end,
    'networkingGoals', to_jsonb(p.networking_goals),
    'contacts', coalesce((
      select jsonb_agg(
        jsonb_build_object('type', c.type, 'value', c.value, 'label', c.label)
        order by c.sort_order, c.id
      )
      from public.contact_methods c
      where c.profile_id = p.id and c.is_public
    ), '[]'::jsonb),
    'socials', coalesce((
      select jsonb_agg(
        jsonb_build_object('platform', s.platform, 'url', s.url)
        order by s.sort_order, s.id
      )
      from public.social_links s
      where s.profile_id = p.id and s.is_public
    ), '[]'::jsonb),
    'updatedAt', p.updated_at,
    'joinedYear', extract(year from p.created_at at time zone 'Africa/Lagos')::int
  )
  from public.profiles p
  where p.slug = lower(btrim(p_slug))
    and p.status = 'published';
$$;

revoke all on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;
