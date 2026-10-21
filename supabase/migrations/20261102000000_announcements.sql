-- One-off announcement emails to members (for example "Spark is here"), sent by
-- an admin from the Invites tab. Each member gets each announcement at most once.

create table if not exists public.announcements_sent (
  kind text not null check (kind in ('spark_beta')),
  email text not null,
  sent_at timestamptz not null default now(),
  primary key (kind, email)
);
alter table public.announcements_sent enable row level security;
revoke all on public.announcements_sent from anon, authenticated;

-- Members with a confirmed account who haven't had this announcement yet.
create or replace function public.admin_announcement_recipients(p_kind text, p_limit integer default 25)
returns table (email text, full_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
    select u.email::text, p.full_name
    from auth.users u
    left join public.profiles p on p.user_id = u.id
    where u.email_confirmed_at is not null
      and u.email is not null
      and not exists (select 1 from public.announcements_sent a where a.kind = p_kind and a.email = u.email)
    order by u.created_at
    limit greatest(least(coalesce(p_limit, 25), 100), 0);
end;
$$;
revoke all on function public.admin_announcement_recipients(text, integer) from public;
revoke execute on function public.admin_announcement_recipients(text, integer) from anon;
grant execute on function public.admin_announcement_recipients(text, integer) to authenticated;

-- Record one send, after the email went out. False if it was already recorded.
create or replace function public.admin_mark_announced(p_kind text, p_email text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  insert into public.announcements_sent (kind, email) values (p_kind, p_email) on conflict do nothing;
  return found;
end;
$$;
revoke all on function public.admin_mark_announced(text, text) from public;
revoke execute on function public.admin_mark_announced(text, text) from anon;
grant execute on function public.admin_mark_announced(text, text) to authenticated;

-- How many have had it, and how many are still to go.
create or replace function public.admin_announcement_status(p_kind text)
returns table (sent integer, remaining integer)
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
      (select count(*)::integer from public.announcements_sent a where a.kind = p_kind),
      (select count(*)::integer from auth.users u
       where u.email_confirmed_at is not null and u.email is not null
         and not exists (select 1 from public.announcements_sent a where a.kind = p_kind and a.email = u.email));
end;
$$;
revoke all on function public.admin_announcement_status(text) from public;
revoke execute on function public.admin_announcement_status(text) from anon;
grant execute on function public.admin_announcement_status(text) to authenticated;
