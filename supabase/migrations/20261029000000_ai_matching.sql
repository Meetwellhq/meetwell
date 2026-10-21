-- AI Network Matching.
--
-- Members who opt in get one-way recommendations of more experienced people in
-- their field (or a related one) to learn from and network with. A daily job
-- (Vercel Cron → /api/cron/matches) picks who is due, asks these functions for
-- scored candidates, lets Claude choose and explain the best one, then records it.
--
-- No monthly cap: at most one match per member per day (the job runs daily).
-- Only members with an account, a confirmed email and a profile at least 80%
-- complete get matches or are recommended (see profile_completeness()).
-- The matching fields are private: they are not part of the public card.

-- ---------------------------------------------------------------------------
-- Profile fields used for matching
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists field text check (
    field is null or field in (
      'product_design', 'software_engineering', 'data_ai', 'product_management',
      'marketing_growth', 'sales_bizdev', 'finance_fintech', 'founder',
      'content_media', 'operations', 'people_hr', 'legal', 'healthcare',
      'education', 'other'
    )
  ),
  add column if not exists experience_years smallint check (experience_years is null or experience_years between 0 and 60),
  add column if not exists looking_for text[] not null default '{}' check (
    looking_for <@ array['mentor', 'mentee', 'peers', 'collaborators', 'opportunities']::text[]
  ),
  add column if not exists city text check (city is null or char_length(btrim(city)) between 1 and 60),
  add column if not exists matching_opt_in boolean not null default false;

-- Related fields, so a small community still finds sensible matches.
create or replace function public.field_group(p_field text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_field in ('product_design', 'software_engineering', 'data_ai', 'product_management') then 'product_tech'
    when p_field in ('marketing_growth', 'sales_bizdev', 'content_media') then 'growth'
    when p_field in ('finance_fintech', 'operations', 'people_hr', 'legal', 'founder') then 'business'
    else p_field
  end;
$$;

-- How complete a profile is, 0 to 100, in steps of 10. Ten items, 10% each
-- (the name is always present, so it doesn't count). Keep in step with
-- src/lib/matching/completeness.ts, which shows members what's missing.
create or replace function public.profile_completeness(p public.profiles)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select 10 * (
      (p.avatar_url is not null)::int
    + (nullif(btrim(coalesce(p.professional_title, '')), '') is not null)::int
    + (nullif(btrim(coalesce(p.organization, '')), '') is not null)::int
    + (nullif(btrim(coalesce(p.bio, '')), '') is not null)::int
    + exists (select 1 from public.contact_methods c where c.profile_id = p.id and c.is_public)::int
    + (exists (select 1 from public.social_links s where s.profile_id = p.id and s.is_public)
       or (p.website_url is not null and p.website_is_public))::int
    + (p.field is not null)::int
    + (p.experience_years is not null)::int
    + (cardinality(p.looking_for) > 0)::int
    + (nullif(btrim(coalesce(p.city, '')), '') is not null)::int
  );
$$;
revoke all on function public.profile_completeness(public.profiles) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Matches
-- ---------------------------------------------------------------------------

create table if not exists public.matches (
  id bigint generated always as identity primary key,
  -- The person who receives the recommendation.
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The card being recommended.
  matched_profile_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 600),
  created_at timestamptz not null default now(),
  emailed_at timestamptz,
  unique (user_id, matched_profile_id)
);
create index if not exists matches_user_created_idx on public.matches (user_id, created_at desc);
create index if not exists matches_profile_created_idx on public.matches (matched_profile_id, created_at desc);

alter table public.matches enable row level security;
revoke all on public.matches from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Job-only functions (protected by the same secret as the reminders job)
-- ---------------------------------------------------------------------------

create or replace function public.check_cron_token(p_token text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  select s.value into v_secret from public.internal_settings s where s.key = 'cron_secret';
  if v_secret is null or char_length(v_secret) < 32 or p_token is distinct from v_secret then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.check_cron_token(text) from public, anon, authenticated;

-- Members due a match today: opted in, confirmed email, published card at least
-- 80% complete, and no match in the last 20 hours (so at most one a day).
create or replace function public.matching_due_users(p_token text, p_limit integer default 40)
returns table (
  user_id uuid, email text, profile_id uuid, full_name text, title text, organization text, bio text,
  field text, experience_years smallint, looking_for text[], city text
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
    select u.id, u.email::text, p.id, p.full_name, p.professional_title, p.organization, p.bio,
      p.field, p.experience_years, p.looking_for, p.city
    from public.profiles p
    join auth.users u on u.id = p.user_id
    where p.matching_opt_in
      and p.status = 'published'
      and p.field is not null
      and u.email_confirmed_at is not null
      and public.profile_completeness(p) >= 80
      and not exists (select 1 from public.matches m
           where m.user_id = u.id and m.created_at > now() - interval '20 hours')
    order by random()
    limit greatest(least(coalesce(p_limit, 40), 200), 0);
end;
$$;
revoke all on function public.matching_due_users(text, integer) from public;
grant execute on function public.matching_due_users(text, integer) to anon;

-- Scored candidates for one member: only people with MORE experience, in the
-- same or a related field. Scores (highest first):
--   same field +50, related field +20;
--   5 points per year of extra experience, up to 10 years (+50);
--   the member wants a mentor and the other person mentors: +30;
--   same city +10; has a photo +5;
--   minus 5 for each time they were recommended in the last week, so
--   recommendations spread across experienced people instead of one person.
-- Never: themselves, someone already recommended to this member, or anyone
-- without a confirmed account or with a profile under 80% complete.
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
      + (case when c.avatar_url is not null then 5 else 0 end)
      - 5 * (select count(*)::integer from public.matches m
             where m.matched_profile_id = c.id and m.created_at > now() - interval '7 days') as score
    from public.profiles c
    where c.matching_opt_in
      and c.status = 'published'
      and c.field is not null
      and c.user_id <> p_user_id
      and public.field_group(c.field) = public.field_group(s.field)
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

-- Records a match. Returns its id, or null if it was already recorded or the
-- member already got a match in the last 20 hours.
create or replace function public.record_match(p_token text, p_user_id uuid, p_profile_id uuid, p_reason text)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  perform public.check_cron_token(p_token);
  if exists (select 1 from public.matches m
             where m.user_id = p_user_id and m.created_at > now() - interval '20 hours') then
    return null;
  end if;
  insert into public.matches (user_id, matched_profile_id, reason)
  values (p_user_id, p_profile_id, left(btrim(p_reason), 600))
  on conflict (user_id, matched_profile_id) do nothing
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.record_match(text, uuid, uuid, text) from public;
grant execute on function public.record_match(text, uuid, uuid, text) to anon;

create or replace function public.mark_match_emailed(p_token text, p_match_id bigint)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.check_cron_token(p_token);
  update public.matches set emailed_at = now() where id = p_match_id;
end;
$$;
revoke all on function public.mark_match_emailed(text, bigint) from public;
grant execute on function public.mark_match_emailed(text, bigint) to anon;

-- ---------------------------------------------------------------------------
-- For members: their own matches (only cards that are still published)
-- ---------------------------------------------------------------------------

create or replace function public.my_matches()
returns table (
  id bigint, created_at timestamptz, reason text,
  slug text, full_name text, title text, organization text, avatar_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.created_at, m.reason, p.slug, p.full_name, p.professional_title, p.organization, p.avatar_url
  from public.matches m
  join public.profiles p on p.id = m.matched_profile_id
  where m.user_id = auth.uid() and p.status = 'published'
  order by m.created_at desc;
$$;
revoke all on function public.my_matches() from public;
revoke execute on function public.my_matches() from anon;
grant execute on function public.my_matches() to authenticated;

-- How many matches the member has had this month (includes cards since unpublished).
create or replace function public.my_matches_this_month()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.matches m
  where m.user_id = auth.uid() and m.created_at >= date_trunc('month', now());
$$;
revoke all on function public.my_matches_this_month() from public;
revoke execute on function public.my_matches_this_month() from anon;
grant execute on function public.my_matches_this_month() to authenticated;
