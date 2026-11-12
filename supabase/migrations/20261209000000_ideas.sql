-- Ideas (member feedback) are kept, not only emailed, so admins can see them
-- all on /admin/ideas and mark each one done. Members send them from the
-- avatar menu or the phone menu; at most 10 an hour each.

create table if not exists public.ideas (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('idea', 'problem', 'other')),
  message text not null check (char_length(btrim(message)) between 3 and 2000),
  page text check (page is null or char_length(page) <= 200),
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ideas_created_idx on public.ideas (created_at desc);
create index if not exists ideas_user_idx on public.ideas (user_id, created_at desc);
alter table public.ideas enable row level security;
revoke all on public.ideas from anon, authenticated;

-- A signed-in member sends an idea. Returns its id.
create or replace function public.submit_idea(p_kind text, p_message text, p_page text default null)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id bigint;
begin
  if v_user is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if (select count(*) from public.ideas where user_id = v_user and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many ideas, try again later' using errcode = '54000';
  end if;
  insert into public.ideas (user_id, kind, message, page)
  values (v_user, p_kind, btrim(p_message), nullif(btrim(coalesce(p_page, '')), ''))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.submit_idea(text, text, text) from public;
revoke execute on function public.submit_idea(text, text, text) from anon;
grant execute on function public.submit_idea(text, text, text) to authenticated;

-- Admins: every idea, newest first, with who sent it.
create or replace function public.admin_list_ideas()
returns table (
  id bigint, kind text, message text, page text, done_at timestamptz, created_at timestamptz,
  full_name text, email text, profile_slug text
)
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
    select i.id, i.kind, i.message, i.page, i.done_at, i.created_at,
           p.full_name, u.email::text, p.slug
    from public.ideas i
    left join auth.users u on u.id = i.user_id
    left join public.profiles p on p.user_id = i.user_id
    order by i.created_at desc;
end;
$$;
revoke all on function public.admin_list_ideas() from public;
revoke execute on function public.admin_list_ideas() from anon;
grant execute on function public.admin_list_ideas() to authenticated;

-- Admins: mark an idea done, or new again.
create or replace function public.admin_set_idea_done(p_id bigint, p_done boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.ideas set done_at = case when p_done then coalesce(done_at, now()) end where id = p_id;
end;
$$;
revoke all on function public.admin_set_idea_done(bigint, boolean) from public;
revoke execute on function public.admin_set_idea_done(bigint, boolean) from anon;
grant execute on function public.admin_set_idea_done(bigint, boolean) to authenticated;
