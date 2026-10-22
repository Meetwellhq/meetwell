-- Lets the log-in page say "no account with that email" instead of a vague
-- "email and password don't match". Called only after a failed log-in (which
-- is rate-limited per connection). Sign-up already says when an email has an
-- account, so this shares nothing new. Admin accounts are never reported.

create or replace function public.account_exists(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    where lower(u.email) = lower(btrim(coalesce(p_email, '')))
      and u.deleted_at is null
      and not public.is_admin_user(u.id)
  );
$$;

revoke all on function public.account_exists(text) from public;
grant execute on function public.account_exists(text) to anon, authenticated;
