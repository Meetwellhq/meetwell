-- Announcements: a "publish your card" email for people whose card is still a
-- draft, sent by the admin like the others (each person once).
--
-- Also fixes the allowed kinds: only 'spark_beta' was allowed, so the
-- Mentoring announcement couldn't be recorded as sent and could go to the
-- same people again on every click.

alter table public.announcements_sent drop constraint if exists announcements_sent_kind_check;
alter table public.announcements_sent
  add constraint announcements_sent_kind_check check (kind in ('spark_beta', 'mentoring', 'publish_card'));

-- Members with a confirmed account who haven't had this announcement yet.
-- 'publish_card' goes only to people whose card is a draft.
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
      and not public.is_admin_user(u.id)
      and (p_kind <> 'publish_card' or p.status = 'draft')
      and not exists (select 1 from public.announcements_sent a where a.kind = p_kind and a.email = u.email)
    order by u.created_at
    limit greatest(least(coalesce(p_limit, 25), 100), 0);
end;
$$;
revoke all on function public.admin_announcement_recipients(text, integer) from public;
revoke execute on function public.admin_announcement_recipients(text, integer) from anon;
grant execute on function public.admin_announcement_recipients(text, integer) to authenticated;

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
       left join public.profiles p on p.user_id = u.id
       where u.email_confirmed_at is not null and u.email is not null
         and not public.is_admin_user(u.id)
         and (p_kind <> 'publish_card' or p.status = 'draft')
         and not exists (select 1 from public.announcements_sent a where a.kind = p_kind and a.email = u.email));
end;
$$;
revoke all on function public.admin_announcement_status(text) from public;
revoke execute on function public.admin_announcement_status(text) from anon;
grant execute on function public.admin_announcement_status(text) to authenticated;
