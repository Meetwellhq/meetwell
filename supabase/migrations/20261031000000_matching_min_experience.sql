-- AI Network Matching: only members with at least 4 years of experience AND a
-- profile photo can be recommended (still only to people with less experience
-- than them). Anyone at 80%+ can still receive matches.

-- Scored candidates for one member: only people with 4+ years AND more experience
-- than the member, in the same or a related field. Scores (highest first):
--   same field +50, related field +20;
--   5 points per year of extra experience, up to 10 years (+50);
--   the member wants a mentor and the other person mentors: +30;
--   same city +10;
--   minus 5 for each time they were recommended in the last week, so
--   recommendations spread across experienced people instead of one person.
-- Never: themselves, someone already recommended to this member, or anyone
-- without a photo, a confirmed account or a profile at least 80% complete.
create or replace function public.matching_candidates(p_token text, p_user_id uuid, p_limit integer default 8)
returns table (
  profile_id uuid, slug text, full_name text, title text, organization text, bio text,
  field text, experience_years smallint, looking_for text[], city text, has_photo boolean, score integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  s public.profiles%rowtype;
begin
  perform public.check_cron_token(p_token);
  select * into s from public.profiles where user_id = p_user_id;
  if not found or s.field is null then
    return;
  end if;

  return query
  with scored as (
    select c.*,
      (case when c.field = s.field then 50 when public.field_group(c.field) = public.field_group(s.field) then 20 else 0 end)
      + least(coalesce(c.experience_years, 0) - coalesce(s.experience_years, 0), 10) * 5
      + (case when 'mentor' = any(s.looking_for) and 'mentee' = any(c.looking_for) then 30 else 0 end)
      + (case when c.city is not null and s.city is not null and lower(c.city) = lower(s.city) then 10 else 0 end)
      - 5 * (select count(*)::integer from public.matches m
             where m.matched_profile_id = c.id and m.created_at > now() - interval '7 days') as score
    from public.profiles c
    where c.matching_opt_in
      and c.status = 'published'
      and c.field is not null
      and c.user_id <> p_user_id
      and public.field_group(c.field) = public.field_group(s.field)
      and coalesce(c.experience_years, 0) >= 4
      and c.avatar_url is not null
      and coalesce(c.experience_years, 0) > coalesce(s.experience_years, 0)
      and public.profile_completeness(c) >= 80
      and exists (select 1 from auth.users u where u.id = c.user_id and u.email_confirmed_at is not null)
      and not exists (select 1 from public.matches m where m.user_id = p_user_id and m.matched_profile_id = c.id)
  )
  select sc.id, sc.slug, sc.full_name, sc.professional_title, sc.organization, sc.bio,
    sc.field, sc.experience_years, sc.looking_for, sc.city, sc.avatar_url is not null, sc.score
  from scored sc
  order by sc.score desc, random()
  limit greatest(least(coalesce(p_limit, 8), 20), 0);
end;
$$;
revoke all on function public.matching_candidates(text, uuid, integer) from public;
grant execute on function public.matching_candidates(text, uuid, integer) to anon;

-- The profile reminder also needs experience and field, so the email can speak
-- differently to experienced members (people want to learn from you) and to
-- members earlier in their careers (a photo gets you matches).
drop function if exists public.claim_reminders(text, integer);
create function public.claim_reminders(p_token text, p_limit integer default 40)
returns table (
  kind text, email text, full_name text, access_code text,
  completeness integer, has_photo boolean, experience_years smallint, field text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.check_cron_token(p_token);

  return query
  with candidates as (
    select 'invite_unused'::text as kind, w.email, w.full_name, w.access_code,
      null::integer as completeness, null::boolean as has_photo,
      null::smallint as experience_years, null::text as field
    from public.waitlist w
    join public.access_codes c on c.code = w.access_code
    where w.invited_at < now() - interval '3 days'
      and c.uses < c.max_uses
      and (c.expires_at is null or c.expires_at > now())

    union all
    select 'email_unconfirmed', u.email::text, null::text, null::text, null::integer, null::boolean, null::smallint, null::text
    from auth.users u
    where u.email_confirmed_at is null
      and u.created_at < now() - interval '1 day'
      and u.created_at > now() - interval '14 days'

    union all
    select 'card_draft', u.email::text, p.full_name, null::text, null::integer, null::boolean, null::smallint, null::text
    from auth.users u
    left join public.profiles p on p.user_id = u.id
    where u.email_confirmed_at is not null
      and u.created_at < now() - interval '2 days'
      and (p.id is null or p.status = 'draft')

    union all
    select 'no_scans', u.email::text, p.full_name, null::text, null::integer, null::boolean, null::smallint, null::text
    from auth.users u
    join public.profiles p on p.user_id = u.id
    where p.status = 'published'
      and p.published_at < now() - interval '7 days'
      and not exists (
        select 1 from public.profile_events e
        where e.profile_id = p.id and e.event_type = 'view' and e.source = 'qr'
      )

    union all
    -- Published for a day, but under 80% complete.
    select 'profile_incomplete', u.email::text, p.full_name, null::text,
      public.profile_completeness(p), p.avatar_url is not null, p.experience_years, p.field
    from auth.users u
    join public.profiles p on p.user_id = u.id
    where u.email_confirmed_at is not null
      and p.status = 'published'
      and p.published_at < now() - interval '1 day'
      and public.profile_completeness(p) < 80
  ),
  due as (
    select c.* from candidates c
    where c.email is not null
      and not exists (select 1 from public.reminders_sent r where r.kind = c.kind and r.email = c.email)
    limit greatest(least(coalesce(p_limit, 40), 200), 0)
  ),
  claimed as (
    insert into public.reminders_sent (kind, email)
    select d.kind, d.email from due d
    on conflict do nothing
    returning reminders_sent.kind, reminders_sent.email
  )
  select d.kind, d.email, d.full_name, d.access_code, d.completeness, d.has_photo, d.experience_years, d.field
  from due d
  join claimed cl on cl.kind = d.kind and cl.email = d.email;
end;
$$;

revoke all on function public.claim_reminders(text, integer) from public;
-- The job calls without a user session; the secret is what protects it.
grant execute on function public.claim_reminders(text, integer) to anon;
