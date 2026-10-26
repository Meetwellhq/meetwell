-- Spark is paused until Meetwell has 5,000 users with about as many mentors as
-- mentees (1:1). One switch, off for now; Rasheed turns it on from the admin
-- Overview. While it's off the app hides Spark everywhere, the daily matching
-- job does nothing, credits can't be bought, and the profile score counts only
-- the 8 items that don't need the Spark page ("looking for" and city are asked
-- there), so mentors can still reach the 80% they need.

insert into public.internal_settings (key, value) values ('spark_enabled', 'false') on conflict (key) do nothing;

-- Anyone may ask whether Spark is on (the menu, the landing page).
create or replace function public.spark_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.value = 'true' from public.internal_settings s where s.key = 'spark_enabled'), false);
$$;
revoke all on function public.spark_enabled() from public;
grant execute on function public.spark_enabled() to anon, authenticated;

create or replace function public.admin_set_spark_enabled(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  insert into public.internal_settings (key, value) values ('spark_enabled', case when p_enabled then 'true' else 'false' end)
  on conflict (key) do update set value = excluded.value;
end;
$$;
revoke all on function public.admin_set_spark_enabled(boolean) from public;
revoke execute on function public.admin_set_spark_enabled(boolean) from anon;
grant execute on function public.admin_set_spark_enabled(boolean) to authenticated;

-- Progress towards the launch: users (confirmed, not admins), and among them
-- mentors (4+ years) and mentees (under 4).
create or replace function public.admin_spark_progress()
returns table (users integer, mentors integer, mentees integer, enabled boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
    select
      (select count(*)::integer from auth.users u where u.email_confirmed_at is not null and not public.is_admin_user(u.id)),
      (select count(*)::integer from public.profiles p where p.experience_years >= 4 and not public.is_admin_user(p.user_id)),
      (select count(*)::integer from public.profiles p where p.experience_years < 4 and not public.is_admin_user(p.user_id)),
      public.spark_enabled();
end;
$$;
revoke all on function public.admin_spark_progress() from public;
revoke execute on function public.admin_spark_progress() from anon;
grant execute on function public.admin_spark_progress() to authenticated;

-- The profile score: 10 items with Spark on; the 8 card items while it's off.
-- Keep in step with profileCompleteness() in src/lib/matching/completeness.ts.
create or replace function public.profile_completeness(p public.profiles)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with card as (
    select
        (p.avatar_url is not null)::int
      + (nullif(btrim(coalesce(p.professional_title, '')), '') is not null)::int
      + (nullif(btrim(coalesce(p.organization, '')), '') is not null)::int
      + (nullif(btrim(coalesce(p.bio, '')), '') is not null)::int
      + exists (select 1 from public.contact_methods c where c.profile_id = p.id and c.is_public)::int
      + (exists (select 1 from public.social_links s where s.profile_id = p.id and s.is_public)
         or (p.website_url is not null and p.website_is_public))::int
      + (p.field is not null)::int
      + (p.experience_years is not null)::int as n
  )
  select case
    when public.spark_enabled() then
      10 * (card.n + (cardinality(p.looking_for) > 0)::int + (nullif(btrim(coalesce(p.city, '')), '') is not null)::int)
    else round(card.n * 100.0 / 8)::integer
  end
  from card;
$$;
revoke all on function public.profile_completeness(public.profiles) from public, anon, authenticated;
