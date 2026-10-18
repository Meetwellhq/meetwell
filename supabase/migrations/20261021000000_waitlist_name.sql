-- Collect a name with each waiting-list email.

alter table public.waitlist
  add column if not exists full_name text check (full_name is null or char_length(btrim(full_name)) between 1 and 80);

drop function if exists public.join_waitlist(text);

-- Returns true only when the email is new, so the welcome email is sent once.
create or replace function public.join_waitlist(p_email text, p_full_name text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with inserted as (
    insert into public.waitlist (email, full_name)
    values (lower(trim(p_email)), nullif(btrim(p_full_name), ''))
    on conflict (email) do nothing
    returning 1
  )
  select exists (select 1 from inserted);
$$;

revoke all on function public.join_waitlist(text, text) from public;
grant execute on function public.join_waitlist(text, text) to anon, authenticated;
