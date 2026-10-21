-- Mentors: drop the "on Meetwell for 14 days" requirement. Every mentor is
-- approved by an admin anyway, which is the real check during the beta.
create or replace function public.mentor_checks(p_user uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'years', coalesce(p.experience_years >= 4, false),
    'photo', p.avatar_url is not null,
    'complete', coalesce(public.profile_completeness(p) >= 80, false),
    'confirmed', u.email_confirmed_at is not null,
    'published', coalesce(p.status = 'published', false)
  )
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  where u.id = p_user;
$$;
revoke all on function public.mentor_checks(uuid) from public, anon, authenticated;
