-- Invite tool: admins can see the waiting list and send personal access codes.
--
-- Make yourself an admin (in the SQL Editor, with your own login email):
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'you@example.com';

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Track who has been invited, and with which code.
alter table public.waitlist
  add column if not exists invited_at timestamptz,
  add column if not exists access_code text references public.access_codes (code) on delete set null;

-- The waiting list with each person's invite status. Admins only.
create or replace function public.admin_list_waitlist()
returns table (
  email text,
  full_name text,
  joined_at timestamptz,
  invited_at timestamptz,
  signed_up boolean
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
    select w.email, w.full_name, w.created_at, w.invited_at, coalesce(c.uses > 0, false)
    from public.waitlist w
    left join public.access_codes c on c.code = w.access_code
    order by w.created_at;
end;
$$;

revoke all on function public.admin_list_waitlist() from public;
grant execute on function public.admin_list_waitlist() to authenticated;

-- Give someone on the waiting list a personal, single-use code (valid 30 days).
-- Inviting again re-sends their code if it is still unused and unexpired.
create or replace function public.admin_invite(p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_code text;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select w.access_code into v_code from public.waitlist w where w.email = v_email for update;
  if not found then
    raise exception 'That email is not on the waiting list' using errcode = 'P0002';
  end if;

  if v_code is null or not exists (
    select 1 from public.access_codes c
    where c.code = v_code and c.uses < c.max_uses and (c.expires_at is null or c.expires_at > now())
  ) then
    -- 12 random hex characters from a UUID (cryptographically random).
    v_code := 'MW-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    v_code := substr(v_code, 1, 7) || '-' || substr(v_code, 8, 4) || '-' || substr(v_code, 12, 4);
    insert into public.access_codes (code, max_uses, note, expires_at)
    values (v_code, 1, 'Invite for ' || v_email, now() + interval '30 days');
  end if;

  update public.waitlist set access_code = v_code, invited_at = now() where email = v_email;
  return v_code;
end;
$$;

revoke all on function public.admin_invite(text) from public;
grant execute on function public.admin_invite(text) to authenticated;
