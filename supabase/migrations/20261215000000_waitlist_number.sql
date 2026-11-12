-- Waiting-list numbers: everyone who joins is told their place ("You're number 128").
-- Existing people are numbered in the order they joined. New numbers come from a
-- sequence, and only a new email takes one, so duplicates leave no gaps.

alter table public.waitlist add column if not exists join_number integer;

update public.waitlist w
   set join_number = n.rn
  from (select email, row_number() over (order by created_at, email) as rn from public.waitlist) n
 where w.email = n.email and w.join_number is null;

create sequence if not exists public.waitlist_join_number_seq as integer owned by public.waitlist.join_number;
select setval('public.waitlist_join_number_seq', coalesce((select max(join_number) from public.waitlist), 0) + 1, false);
revoke all on sequence public.waitlist_join_number_seq from public, anon, authenticated;

alter table public.waitlist
  alter column join_number set default nextval('public.waitlist_join_number_seq'),
  alter column join_number set not null;

create unique index if not exists waitlist_join_number_idx on public.waitlist (join_number);

-- Like join_waitlist_with_token(), but also returns the person's number.
-- No row back if the email was already on the list.
create or replace function public.join_waitlist_numbered(p_email text, p_full_name text)
returns table (unsubscribe_token uuid, join_number integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.waitlist w where w.email = lower(trim(p_email))) then
    return;
  end if;
  return query
    insert into public.waitlist as w (email, full_name)
    values (lower(trim(p_email)), nullif(btrim(p_full_name), ''))
    on conflict (email) do nothing
    returning w.unsubscribe_token, w.join_number;
end;
$$;

revoke all on function public.join_waitlist_numbered(text, text) from public;
grant execute on function public.join_waitlist_numbered(text, text) to anon, authenticated;

-- The older join functions go through the new one, so a duplicate never uses up a number.
create or replace function public.join_waitlist_with_token(p_email text, p_full_name text)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select n.unsubscribe_token from public.join_waitlist_numbered(p_email, p_full_name) n;
$$;

create or replace function public.join_waitlist(p_email text, p_full_name text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (select 1 from public.join_waitlist_numbered(p_email, p_full_name));
$$;
