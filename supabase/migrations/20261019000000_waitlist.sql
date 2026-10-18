-- Early-access waitlist for the private beta.
-- Nobody can read or write the table directly; visitors can only add an email
-- through join_waitlist(). View sign-ups in the Supabase dashboard
-- (Table Editor → waitlist).

create table if not exists public.waitlist (
  email text primary key check (char_length(email) between 3 and 254 and email like '%_@_%'),
  created_at timestamptz not null default now()
);

alter table public.waitlist enable row level security;
revoke all on public.waitlist from anon, authenticated;

-- Returns true only when the email is new, so the welcome email is sent once.
create or replace function public.join_waitlist(p_email text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with inserted as (
    insert into public.waitlist (email)
    values (lower(trim(p_email)))
    on conflict (email) do nothing
    returning 1
  )
  select exists (select 1 from inserted);
$$;

revoke all on function public.join_waitlist(text) from public;
grant execute on function public.join_waitlist(text) to anon, authenticated;
