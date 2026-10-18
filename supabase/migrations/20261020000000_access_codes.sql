-- Invite-only sign-up for the private beta.
--
-- New accounts need a valid access code. The code travels in the sign-up
-- request's user metadata, and a trigger on auth.users checks and uses it up
-- inside the same transaction, so sign-up can't be done without a code even
-- by calling the Supabase API directly.
--
-- Create codes in the SQL Editor, e.g.:
--   insert into public.access_codes (code, max_uses, note)
--   values ('MEETWELL-7KQ2-XR4P', 50, 'Launch invites');
-- See usage: select * from public.access_codes;
-- Reopen public sign-up later: create or replace public.invite_only() to return false.

create table if not exists public.access_codes (
  code text primary key check (code = upper(code) and char_length(code) between 6 and 64),
  max_uses integer not null default 1 check (max_uses > 0),
  uses integer not null default 0 check (uses >= 0),
  expires_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

alter table public.access_codes enable row level security;
revoke all on public.access_codes from anon, authenticated;

-- Codes are matched case-insensitively and ignore spaces.
create or replace function public.normalize_access_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
$$;

create or replace function public.invite_only()
returns boolean
language sql
immutable
set search_path = ''
as $$
  select true;
$$;

-- Lets the sign-up page say "that code doesn't work" before asking for a password.
create or replace function public.check_access_code(p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.access_codes
    where code = public.normalize_access_code(p_code)
      and uses < max_uses
      and (expires_at is null or expires_at > now())
  );
$$;

revoke all on function public.check_access_code(text) from public;
grant execute on function public.check_access_code(text) to anon, authenticated;

create or replace function public.enforce_access_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.invite_only() then
    update public.access_codes
       set uses = uses + 1
     where code = public.normalize_access_code(new.raw_user_meta_data ->> 'access_code')
       and uses < max_uses
       and (expires_at is null or expires_at > now());
    if not found then
      raise exception 'A valid access code is required to create an account';
    end if;
  end if;
  -- Don't keep the code on the user record.
  new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb) - 'access_code';
  return new;
end;
$$;

revoke all on function public.enforce_access_code() from public, anon, authenticated;

drop trigger if exists auth_users_require_access_code on auth.users;
create trigger auth_users_require_access_code
  before insert on auth.users
  for each row execute function public.enforce_access_code();
