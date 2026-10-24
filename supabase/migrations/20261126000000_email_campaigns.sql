-- Admin "New email": pick a ready-made email and who gets it (role, card,
-- photo, profile completeness, last seen), preview, then send in batches.
-- email_sends logs every send, so nobody gets the same email twice unless the
-- admin allows a resend after some days. Older one-off announcements
-- (announcements_sent) count too, so nobody gets those again by accident.

create table if not exists public.email_sends (
  id bigint generated always as identity primary key,
  template text not null check (template in ('publish_card', 'add_photo', 'finish_profile', 'spark_beta', 'mentoring')),
  email text not null,
  sent_at timestamptz not null default now()
);
create index if not exists email_sends_template_email on public.email_sends (template, email, sent_at desc);
alter table public.email_sends enable row level security;
revoke all on public.email_sends from anon, authenticated;

-- Confirmed members (never admins) who match the filters and haven't had this
-- email (or not within p_resend_days). Mentors have 4+ years, mentees under 4;
-- 'unset' is no card or no years yet, as on the admin Users page.
create or replace function public.admin_email_audience(
  p_template text,
  p_role text default 'all',
  p_card text default 'all',
  p_no_photo boolean default false,
  p_under_80 boolean default false,
  p_inactive_days integer default null,
  p_resend_days integer default null,
  p_limit integer default 40
)
returns table (email text, full_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_template not in ('publish_card', 'add_photo', 'finish_profile', 'spark_beta', 'mentoring')
     or p_role not in ('all', 'mentor', 'mentee', 'unset')
     or p_card not in ('all', 'published', 'draft', 'unpublished', 'none') then
    raise exception 'Unknown email or filter' using errcode = '22023';
  end if;
  return query
    select u.email::text, p.full_name
    from auth.users u
    left join public.profiles p on p.user_id = u.id
    where u.email_confirmed_at is not null
      and u.email is not null
      and not public.is_admin_user(u.id)
      and (p_role = 'all'
        or (p_role = 'mentor' and p.experience_years >= 4)
        or (p_role = 'mentee' and p.experience_years < 4)
        or (p_role = 'unset' and p.experience_years is null))
      and (p_card = 'all' or (p_card = 'none' and p.id is null) or p.status::text = p_card)
      and (not coalesce(p_no_photo, false) or (p.id is not null and p.avatar_url is null))
      and (not coalesce(p_under_80, false) or (p.id is not null and public.profile_completeness(p) < 80))
      and (p_inactive_days is null
        or coalesce(u.last_sign_in_at, u.created_at) < now() - make_interval(days => p_inactive_days))
      and not exists (
        select 1 from public.email_sends s
        where s.template = p_template and s.email = u.email
          and (p_resend_days is null or s.sent_at > now() - make_interval(days => p_resend_days)))
      and not exists (
        select 1 from public.announcements_sent a
        where a.kind = p_template and a.email = u.email
          and (p_resend_days is null or a.sent_at > now() - make_interval(days => p_resend_days)))
    order by u.created_at
    limit greatest(least(coalesce(p_limit, 40), 5000), 0);
end;
$$;
revoke all on function public.admin_email_audience(text, text, text, boolean, boolean, integer, integer, integer) from public;
revoke execute on function public.admin_email_audience(text, text, text, boolean, boolean, integer, integer, integer) from anon;
grant execute on function public.admin_email_audience(text, text, text, boolean, boolean, integer, integer, integer) to authenticated;

-- How many people the filters match right now.
create or replace function public.admin_email_audience_count(
  p_template text,
  p_role text default 'all',
  p_card text default 'all',
  p_no_photo boolean default false,
  p_under_80 boolean default false,
  p_inactive_days integer default null,
  p_resend_days integer default null
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.admin_email_audience(p_template, p_role, p_card, p_no_photo, p_under_80, p_inactive_days, p_resend_days, 5000);
$$;
revoke all on function public.admin_email_audience_count(text, text, text, boolean, boolean, integer, integer) from public;
revoke execute on function public.admin_email_audience_count(text, text, text, boolean, boolean, integer, integer) from anon;
grant execute on function public.admin_email_audience_count(text, text, text, boolean, boolean, integer, integer) to authenticated;

-- Record one send, after the email went out.
create or replace function public.admin_record_email_send(p_template text, p_email text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  insert into public.email_sends (template, email) values (p_template, p_email);
end;
$$;
revoke all on function public.admin_record_email_send(text, text) from public;
revoke execute on function public.admin_record_email_send(text, text) from anon;
grant execute on function public.admin_record_email_send(text, text) to authenticated;

-- What went out, by email and day (Lagos time), newest first.
create or replace function public.admin_email_history()
returns table (template text, sent_on date, people integer)
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
    select s.template, (s.sent_at at time zone 'Africa/Lagos')::date, count(*)::integer
    from public.email_sends s
    group by 1, 2
    order by 2 desc, 1
    limit 50;
end;
$$;
revoke all on function public.admin_email_history() from public;
revoke execute on function public.admin_email_history() from anon;
grant execute on function public.admin_email_history() to authenticated;
