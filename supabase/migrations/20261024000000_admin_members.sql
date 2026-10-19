-- Admin view of everyone with an account: are they set up, and is their card
-- being used? Only counts and status; no visitor data.

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
  contacts_saved bigint
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
      coalesce(e.contacts_saved, 0)
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
