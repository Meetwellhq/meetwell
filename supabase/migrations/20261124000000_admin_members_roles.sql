-- Admin Users page: split people into mentors (4+ years) and mentees (under 4),
-- so the ratio can be watched and balanced. Adds years of experience and the
-- mentoring application status to admin_list_members(). The return type
-- changes, so the function is dropped and made again.

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
  reminders jsonb,
  experience_years smallint,
  mentor_status text
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
      ), '[]'::jsonb),
      p.experience_years,
      ms.status
    from auth.users u
    left join public.profiles p on p.user_id = u.id
    left join public.mentor_settings ms on ms.user_id = u.id
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
