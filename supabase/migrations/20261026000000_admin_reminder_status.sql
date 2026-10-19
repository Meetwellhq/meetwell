-- Show which automatic reminders each person has been sent, on the admin
-- Invites page. The return types change, so the functions are recreated.

drop function if exists public.admin_list_waitlist();
create function public.admin_list_waitlist()
returns table (
  email text,
  full_name text,
  joined_at timestamptz,
  invited_at timestamptz,
  signed_up boolean,
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
    select w.email, w.full_name, w.created_at, w.invited_at, coalesce(c.uses > 0, false),
      coalesce((
        select jsonb_agg(jsonb_build_object('kind', r.kind, 'sent_at', r.sent_at) order by r.sent_at)
        from public.reminders_sent r
        where r.email = w.email and r.kind = 'invite_unused'
      ), '[]'::jsonb)
    from public.waitlist w
    left join public.access_codes c on c.code = w.access_code
    order by w.created_at;
end;
$$;
revoke all on function public.admin_list_waitlist() from public;
revoke execute on function public.admin_list_waitlist() from anon;
grant execute on function public.admin_list_waitlist() to authenticated;

drop function if exists public.admin_list_members();
create function public.admin_list_members()
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
        where r.email = u.email and r.kind in ('email_unconfirmed', 'card_draft', 'no_scans')
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
