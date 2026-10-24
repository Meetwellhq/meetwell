-- Spark: 1 free introduction a month instead of 5. Credits still add more, at
-- most one a day. The limit now lives in one place, spark_free_per_month(),
-- and must match SPARK_FREE_PER_MONTH in src/lib/matching/constants.ts.

create or replace function public.spark_free_per_month()
returns integer
language sql
immutable
set search_path = ''
as $$ select 1 $$;
revoke all on function public.spark_free_per_month() from public;
revoke all on function public.spark_free_per_month() from anon;
revoke all on function public.spark_free_per_month() from authenticated;

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
      and (public.spark_matches_this_month(u.id) < public.spark_free_per_month()
           or public.spark_credit_balance(u.id) > 0)
    order by random()
    limit greatest(least(coalesce(p_limit, 40), 200), 0);
end;
$$;
revoke all on function public.matching_due_users(text, integer) from public;
grant execute on function public.matching_due_users(text, integer) to anon;

-- Records a match. After the free one this month it uses one credit, in the
-- same step. Returns the match id, or null if it was already recorded, the
-- member had one in the last 20 hours, or they're out of free matches and credits.
create or replace function public.record_match(p_token text, p_user_id uuid, p_profile_id uuid, p_reason text)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_paid boolean;
begin
  perform public.check_cron_token(p_token);
  -- One member at a time, so two runs can't spend the same credit.
  perform pg_advisory_xact_lock(hashtext('record_match:' || p_user_id::text));
  if exists (select 1 from public.matches m
             where m.user_id = p_user_id and m.created_at > now() - interval '20 hours') then
    return null;
  end if;
  v_paid := public.spark_matches_this_month(p_user_id) >= public.spark_free_per_month();
  if v_paid and public.spark_credit_balance(p_user_id) <= 0 then
    return null;
  end if;
  insert into public.matches (user_id, matched_profile_id, reason)
  values (p_user_id, p_profile_id, left(btrim(p_reason), 600))
  on conflict (user_id, matched_profile_id) do nothing
  returning id into v_id;
  if v_id is not null and v_paid then
    insert into public.credit_ledger (user_id, delta, reason, match_id) values (p_user_id, -1, 'match', v_id);
  end if;
  return v_id;
end;
$$;
revoke all on function public.record_match(text, uuid, uuid, text) from public;
grant execute on function public.record_match(text, uuid, uuid, text) to anon;
