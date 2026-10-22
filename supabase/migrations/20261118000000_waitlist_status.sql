-- The waiting list showed "Signed up" as soon as a person's invite code was
-- used, even when someone else used it or no account was made with that email.
-- Now "signed up" means an account exists with that email, "confirmed" whether
-- they confirmed it, and "code_used" whether their current code is spent (so
-- the admin can send a fresh one; admin_invite already makes a new code when
-- the old one is used up).

drop function if exists public.admin_list_waitlist();
create function public.admin_list_waitlist()
returns table (
  email text,
  full_name text,
  joined_at timestamptz,
  invited_at timestamptz,
  signed_up boolean,
  reminders jsonb,
  confirmed boolean,
  code_used boolean
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
    select w.email, w.full_name, w.created_at, w.invited_at,
      (u.id is not null),
      coalesce((
        select jsonb_agg(jsonb_build_object('kind', r.kind, 'sent_at', r.sent_at) order by r.sent_at)
        from public.reminders_sent r
        where r.email = w.email and r.kind = 'invite_unused'
      ), '[]'::jsonb),
      (u.email_confirmed_at is not null),
      coalesce(c.uses >= c.max_uses or (c.expires_at is not null and c.expires_at <= now()), false)
    from public.waitlist w
    left join public.access_codes c on c.code = w.access_code
    left join lateral (
      select au.id, au.email_confirmed_at from auth.users au where lower(au.email) = lower(w.email) limit 1
    ) u on true
    order by w.created_at;
end;
$$;
revoke all on function public.admin_list_waitlist() from public;
revoke execute on function public.admin_list_waitlist() from anon;
grant execute on function public.admin_list_waitlist() to authenticated;
