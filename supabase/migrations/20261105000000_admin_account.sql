-- A separate admin account (admin@meetwell.me) runs Meetwell from /admin. It has
-- no card, so it's left out of the Members list, announcements and the automatic
-- reminders. Same function shapes as before.
--
-- Making the switch (run by hand once the admin account exists):
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'admin@meetwell.me' on conflict do nothing;
--   delete from public.admins
--   where user_id <> (select id from auth.users where email = 'admin@meetwell.me');

create or replace function public.is_admin_user(p_user_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = p_user_id);
$$;
revoke all on function public.is_admin_user(uuid) from public, anon, authenticated;

create or replace function public.admin_list_members()
returns table (
  email text,
  joined_at timestamptz,
  confirmed boolean,
  last_sign_in_at timestamptz,
  full_name text,
  slug text,
  card_status text,
  has_photo boolean,
  views bigint,
  qr_scans bigint,
  contacts_saved bigint,
  reminders jsonb
)
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
      u.email::text,
      u.created_at,
      u.email_confirmed_at is not null,
      u.last_sign_in_at,
      p.full_name,
      p.slug,
      p.status::text,
      p.avatar_url is not null,
      coalesce(e.views, 0),
      coalesce(e.qr_scans, 0),
      coalesce(e.contacts_saved, 0),
      coalesce((
        select jsonb_agg(jsonb_build_object('kind', r.kind, 'sent_at', r.sent_at) order by r.sent_at)
        from public.reminders_sent r
        where r.email = u.email and r.kind in ('email_unconfirmed', 'card_draft', 'no_scans', 'profile_incomplete')
      ), '[]'::jsonb)
    from auth.users u
    left join public.profiles p on p.user_id = u.id
    left join lateral (
      select
        count(*) filter (where pe.event_type = 'view') as views,
        count(*) filter (where pe.event_type = 'view' and pe.source = 'qr') as qr_scans,
        count(*) filter (where pe.event_type = 'save_contact') as contacts_saved
      from public.profile_events pe
      where pe.profile_id = p.id
    ) e on true
    where not public.is_admin_user(u.id)
    order by u.created_at desc;
end;
$$;
revoke all on function public.admin_list_members() from public;
revoke execute on function public.admin_list_members() from anon;
grant execute on function public.admin_list_members() to authenticated;

create or replace function public.admin_announcement_recipients(p_kind text, p_limit integer default 25)
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
  return query
    select u.email::text, p.full_name
    from auth.users u
    left join public.profiles p on p.user_id = u.id
    where u.email_confirmed_at is not null
      and u.email is not null
      and not public.is_admin_user(u.id)
      and not exists (select 1 from public.announcements_sent a where a.kind = p_kind and a.email = u.email)
    order by u.created_at
    limit greatest(least(coalesce(p_limit, 25), 100), 0);
end;
$$;
revoke all on function public.admin_announcement_recipients(text, integer) from public;
revoke execute on function public.admin_announcement_recipients(text, integer) from anon;
grant execute on function public.admin_announcement_recipients(text, integer) to authenticated;

create or replace function public.admin_announcement_status(p_kind text)
returns table (sent integer, remaining integer)
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
      (select count(*)::integer from public.announcements_sent a where a.kind = p_kind),
      (select count(*)::integer from auth.users u
       where u.email_confirmed_at is not null and u.email is not null
         and not public.is_admin_user(u.id)
         and not exists (select 1 from public.announcements_sent a where a.kind = p_kind and a.email = u.email));
end;
$$;
revoke all on function public.admin_announcement_status(text) from public;
revoke execute on function public.admin_announcement_status(text) from anon;
grant execute on function public.admin_announcement_status(text) to authenticated;

-- Reminders: as before, but never to admin accounts.
create or replace function public.claim_reminders(p_token text, p_limit integer default 40)
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
      and not public.is_admin_user(u.id)

    union all
    select 'card_draft', u.email::text, p.full_name, null::text, null::integer, null::boolean, null::smallint, null::text
    from auth.users u
    left join public.profiles p on p.user_id = u.id
    where u.email_confirmed_at is not null
      and u.created_at < now() - interval '2 days'
      and (p.id is null or p.status = 'draft')
      and not public.is_admin_user(u.id)

    union all
    select 'no_scans', u.email::text, p.full_name, null::text, null::integer, null::boolean, null::smallint, null::text
    from auth.users u
    join public.profiles p on p.user_id = u.id
    where p.status = 'published'
      and p.published_at < now() - interval '7 days'
      and not public.is_admin_user(u.id)
      and not exists (
        select 1 from public.profile_events e
        where e.profile_id = p.id and e.event_type = 'view' and e.source = 'qr'
      )

    union all
    select 'profile_incomplete', u.email::text, p.full_name, null::text,
      public.profile_completeness(p), p.avatar_url is not null, p.experience_years, p.field
    from auth.users u
    join public.profiles p on p.user_id = u.id
    where u.email_confirmed_at is not null
      and p.status = 'published'
      and p.published_at < now() - interval '1 day'
      and public.profile_completeness(p) < 80
      and not public.is_admin_user(u.id)
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
grant execute on function public.claim_reminders(text, integer) to anon;
