-- A one-time "complete your profile" reminder for members whose published card
-- is under 80% complete (the threshold for AI Network Matching), with a nudge
-- to add a photo if they don't have one. Builds on profile_completeness() from
-- the AI matching migration.
--
-- claim_reminders() now also returns each member's completeness and whether
-- they have a photo. The extra columns are ignored by older code, so the site
-- keeps working between running this and deploying.

alter table public.reminders_sent drop constraint if exists reminders_sent_kind_check;
alter table public.reminders_sent add constraint reminders_sent_kind_check
  check (kind in ('invite_unused', 'email_unconfirmed', 'card_draft', 'no_scans', 'profile_incomplete'));

drop function if exists public.claim_reminders(text, integer);
create function public.claim_reminders(p_token text, p_limit integer default 40)
returns table (kind text, email text, full_name text, access_code text, completeness integer, has_photo boolean)
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
      null::integer as completeness, null::boolean as has_photo
    from public.waitlist w
    join public.access_codes c on c.code = w.access_code
    where w.invited_at < now() - interval '3 days'
      and c.uses < c.max_uses
      and (c.expires_at is null or c.expires_at > now())

    union all
    select 'email_unconfirmed', u.email::text, null::text, null::text, null::integer, null::boolean
    from auth.users u
    where u.email_confirmed_at is null
      and u.created_at < now() - interval '1 day'
      and u.created_at > now() - interval '14 days'

    union all
    select 'card_draft', u.email::text, p.full_name, null::text, null::integer, null::boolean
    from auth.users u
    left join public.profiles p on p.user_id = u.id
    where u.email_confirmed_at is not null
      and u.created_at < now() - interval '2 days'
      and (p.id is null or p.status = 'draft')

    union all
    select 'no_scans', u.email::text, p.full_name, null::text, null::integer, null::boolean
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
      public.profile_completeness(p), p.avatar_url is not null
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
  select d.kind, d.email, d.full_name, d.access_code, d.completeness, d.has_photo
  from due d
  join claimed cl on cl.kind = d.kind and cl.email = d.email;
end;
$$;

revoke all on function public.claim_reminders(text, integer) from public;
-- The job calls without a user session; the secret is what protects it.
grant execute on function public.claim_reminders(text, integer) to anon;

-- Show the new reminder on the admin Members list too (same columns as before).
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
    order by u.created_at desc;
end;
$$;
revoke all on function public.admin_list_members() from public;
revoke execute on function public.admin_list_members() from anon;
grant execute on function public.admin_list_members() to authenticated;
