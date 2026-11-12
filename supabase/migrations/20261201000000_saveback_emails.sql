-- "Saved your card back": when someone saves your card and you had already
-- saved theirs, you get an email. Each pair is noted once, ever, and the daily
-- reminders job sends one email per person listing everyone new since the last
-- one. On by default; off in Settings or with the link in the email.

alter table public.email_prefs add column if not exists saveback_emails boolean not null default true;

-- user_id = the person to tell (who saved first); from_user = who saved them back.
create table if not exists public.saveback_notices (
  user_id uuid not null references auth.users (id) on delete cascade,
  from_user uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  emailed_at timestamptz,
  primary key (user_id, from_user)
);
create index if not exists saveback_notices_due_idx on public.saveback_notices (user_id) where emailed_at is null;
alter table public.saveback_notices enable row level security;
revoke all on public.saveback_notices from anon, authenticated;

-- A new save: if the card's owner had already saved the saver's (published)
-- card, note it for the owner. Admin accounts are left out.
create or replace function public.note_saveback()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select p.user_id into v_owner from public.profiles p where p.id = new.profile_id;
  if v_owner is null or v_owner = new.user_id or public.is_admin_user(v_owner) or public.is_admin_user(new.user_id) then
    return new;
  end if;
  if exists (
    select 1
    from public.saved_contacts s
    join public.profiles mine on mine.id = s.profile_id
    where s.user_id = v_owner and mine.user_id = new.user_id and mine.status = 'published'
  ) then
    insert into public.saveback_notices (user_id, from_user) values (v_owner, new.user_id) on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.note_saveback() from public, anon, authenticated;

drop trigger if exists note_saveback on public.saved_contacts;
create trigger note_saveback after insert on public.saved_contacts for each row execute function public.note_saveback();

-- ---------------------------------------------------------------------------
-- The member's switch
-- ---------------------------------------------------------------------------

create or replace function public.my_saveback_emails()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select e.saveback_emails from public.email_prefs e where e.user_id = auth.uid()), true);
$$;
revoke all on function public.my_saveback_emails() from public;
revoke execute on function public.my_saveback_emails() from anon;
grant execute on function public.my_saveback_emails() to authenticated;

create or replace function public.set_saveback_emails(p_on boolean)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.email_prefs (user_id, saveback_emails) values (auth.uid(), p_on)
  on conflict (user_id) do update set saveback_emails = excluded.saveback_emails;
$$;
revoke all on function public.set_saveback_emails(boolean) from public;
revoke execute on function public.set_saveback_emails(boolean) from anon;
grant execute on function public.set_saveback_emails(boolean) to authenticated;

-- One-click "turn off" from the email (no login), with the same private token as message emails.
create or replace function public.unsubscribe_saveback_emails(p_token uuid)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  with done as (
    update public.email_prefs set saveback_emails = false where token = p_token returning 1
  )
  select exists (select 1 from done);
$$;
revoke all on function public.unsubscribe_saveback_emails(uuid) from public;
grant execute on function public.unsubscribe_saveback_emails(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- For the daily job (secret-protected)
-- ---------------------------------------------------------------------------

-- Everyone with new save-backs: one row each, with the people (public card
-- details only, published cards) as JSON. Marks them done, so each goes out
-- once; people with the emails off are marked done without an email.
create or replace function public.claim_saveback_emails(p_token text, p_limit integer default 40)
returns table (email text, full_name text, token uuid, savers jsonb)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_users uuid[];
begin
  perform public.check_cron_token(p_token);

  update public.saveback_notices n set emailed_at = now()
  from public.email_prefs e
  where n.emailed_at is null and e.user_id = n.user_id and not e.saveback_emails;

  select array_agg(d.user_id) into v_users
  from (
    select n.user_id from public.saveback_notices n
    join auth.users u on u.id = n.user_id
    where n.emailed_at is null and u.email_confirmed_at is not null
    group by n.user_id
    limit greatest(least(coalesce(p_limit, 40), 100), 0)
  ) d;
  if v_users is null then return; end if;

  insert into public.email_prefs (user_id) select unnest(v_users) on conflict (user_id) do nothing;

  return query
    with picked as (
      update public.saveback_notices n set emailed_at = now()
      where n.emailed_at is null and n.user_id = any (v_users)
      returning n.user_id, n.from_user, n.created_at
    )
    select u.email::text, me.full_name, e.token,
      jsonb_agg(jsonb_build_object(
        'full_name', p.full_name, 'slug', p.slug, 'avatar_url', p.avatar_url,
        'title', p.professional_title, 'organization', p.organization
      ) order by k.created_at desc)
    from picked k
    join auth.users u on u.id = k.user_id
    join public.email_prefs e on e.user_id = k.user_id
    left join public.profiles me on me.user_id = k.user_id
    join public.profiles p on p.user_id = k.from_user and p.status = 'published'
    group by u.email, me.full_name, e.token;
end;
$$;
revoke all on function public.claim_saveback_emails(text, integer) from public;
grant execute on function public.claim_saveback_emails(text, integer) to anon, authenticated;
