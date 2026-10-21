-- Spark: free members get up to 5 matches per calendar month (Lagos time),
-- still at most one a day. Same function shapes as before, so the live site
-- keeps working between running this SQL and the deploy.
-- The limit must match SPARK_FREE_PER_MONTH in src/lib/matching/constants.ts.

-- Start of the current month in Lagos.
create or replace function public.spark_month_start()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select date_trunc('month', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
$$;
revoke all on function public.spark_month_start() from public, anon, authenticated;

-- How many matches a member has had this month (Lagos time).
create or replace function public.spark_matches_this_month(p_user_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer from public.matches m
  where m.user_id = p_user_id and m.created_at >= public.spark_month_start();
$$;
revoke all on function public.spark_matches_this_month(uuid) from public, anon, authenticated;

-- Members due a match today: as before, plus fewer than 5 matches this month.
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
      and public.spark_matches_this_month(u.id) < 5
    order by random()
    limit greatest(least(coalesce(p_limit, 40), 200), 0);
end;
$$;
revoke all on function public.matching_due_users(text, integer) from public;
grant execute on function public.matching_due_users(text, integer) to anon;

-- Records a match. Returns its id, or null if it was already recorded, the
-- member already got a match in the last 20 hours, or they've had 5 this month.
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
  if public.spark_matches_this_month(p_user_id) >= 5 then
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

-- The member's own count for the Spark page, now in Lagos months.
create or replace function public.my_matches_this_month()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select public.spark_matches_this_month(auth.uid());
$$;
revoke all on function public.my_matches_this_month() from public;
revoke execute on function public.my_matches_this_month() from anon;
grant execute on function public.my_matches_this_month() to authenticated;
