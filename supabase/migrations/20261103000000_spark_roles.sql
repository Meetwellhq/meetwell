-- Spark has two sides, decided by years of experience:
--   under 4 years: gets introductions (5 free a month);
--   4 years or more: is recommended to people earlier in their careers, and no
--   longer gets introductions themselves.
-- The 4-year line must match MENTOR_MIN_YEARS in src/lib/matching/constants.ts.

-- Members due a match today: as before, plus under 4 years of experience.
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
      and p.experience_years is not null
      and p.experience_years < 4
      and u.email_confirmed_at is not null
      and public.profile_completeness(p) >= 80
      and not exists (select 1 from public.matches m
           where m.user_id = u.id and m.created_at > now() - interval '20 hours')
      and public.spark_matches_this_month(u.id) < 5
    order by random()
    limit greatest(least(coalesce(p_limit, 40), 200), 0);
end;
$$;
revoke all on function public.matching_due_users(text, integer) from public;
grant execute on function public.matching_due_users(text, integer) to anon;

-- For members with 4+ years: how many people Spark has introduced them to,
-- this month (Lagos time) and in total. Counts only, never who.
create or replace function public.my_spark_mentor_stats()
returns table (this_month integer, total integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*) filter (where m.created_at >= public.spark_month_start())::integer,
    count(*)::integer
  from public.matches m
  join public.profiles p on p.id = m.matched_profile_id
  where p.user_id = auth.uid();
$$;
revoke all on function public.my_spark_mentor_stats() from public;
revoke execute on function public.my_spark_mentor_stats() from anon;
grant execute on function public.my_spark_mentor_stats() to authenticated;
