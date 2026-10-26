-- While Spark is paused, a public social media link (Instagram, TikTok,
-- YouTube and the rest) counts instead of the organisation (Rasheed, 26 Oct
-- 2026). The 6 items: photo, job title, bio, a public contact, a social link
-- and years of experience. Mentors still need 80% (5 of 6). With Spark on it's
-- the same 10 items as before.
-- Keep in step with profileCompleteness() in src/lib/matching/completeness.ts.
create or replace function public.profile_completeness(p public.profiles)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with base as (
    select
        (p.avatar_url is not null)::int
      + (nullif(btrim(coalesce(p.professional_title, '')), '') is not null)::int
      + (nullif(btrim(coalesce(p.bio, '')), '') is not null)::int
      + exists (select 1 from public.contact_methods c where c.profile_id = p.id and c.is_public)::int
      + (p.experience_years is not null)::int as n,
      exists (select 1 from public.social_links s where s.profile_id = p.id and s.is_public) as social
  )
  select case
    when public.spark_enabled() then
      10 * (base.n
        + (nullif(btrim(coalesce(p.organization, '')), '') is not null)::int
        + (base.social or (p.website_url is not null and p.website_is_public))::int
        + (p.field is not null)::int
        + (cardinality(p.looking_for) > 0)::int
        + (nullif(btrim(coalesce(p.city, '')), '') is not null)::int)
    else round((base.n + base.social::int) * 100.0 / 6)::integer
  end
  from base;
$$;
revoke all on function public.profile_completeness(public.profiles) from public, anon, authenticated;
