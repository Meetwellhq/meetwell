-- Messaging between a member (under 4 years) and a mentor (4+ years).
--
-- A conversation gives the member access until access_until. In this phase an
-- admin opens test conversations by hand; later a paid subscription sets it.
-- Rules, all enforced here:
--   - only the two people in a conversation can read or write it;
--   - the member writes first; text only, 1 to 2,000 characters; 30 messages an hour;
--   - after access_until the conversation stays visible but is read-only;
--   - either person can block the other (no more messages either way);
--   - any message can be reported; three open reports against someone pause
--     their messaging until an admin looks;
--   - admins see reported messages (with a few around them), never whole chats.
-- Tables are closed to the API; everything goes through the functions below.

create table if not exists public.conversations (
  id bigint generated always as identity primary key,
  member_id uuid not null references auth.users (id) on delete cascade,
  mentor_id uuid not null references auth.users (id) on delete cascade,
  access_until timestamptz not null,
  member_read_at timestamptz,
  mentor_read_at timestamptz,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  check (member_id <> mentor_id),
  unique (member_id, mentor_id)
);
create index if not exists conversations_member_idx on public.conversations (member_id);
create index if not exists conversations_mentor_idx on public.conversations (mentor_id);
alter table public.conversations enable row level security;
revoke all on public.conversations from anon, authenticated;

create table if not exists public.messages (
  id bigint generated always as identity primary key,
  conversation_id bigint not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);
create index if not exists messages_sender_idx on public.messages (sender_id, created_at);
alter table public.messages enable row level security;
revoke all on public.messages from anon, authenticated;

create table if not exists public.blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
alter table public.blocks enable row level security;
revoke all on public.blocks from anon, authenticated;

create table if not exists public.message_reports (
  id bigint generated always as identity primary key,
  message_id bigint not null references public.messages (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reported_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (reason in ('harassment', 'spam', 'scam', 'inappropriate', 'other')),
  note text check (char_length(note) <= 500),
  status text not null default 'open' check (status in ('open', 'dismissed', 'actioned')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (message_id, reporter_id)
);
alter table public.message_reports enable row level security;
revoke all on public.message_reports from anon, authenticated;

create table if not exists public.messaging_paused (
  user_id uuid primary key references auth.users (id) on delete cascade,
  reason text not null,
  paused_at timestamptz not null default now()
);
alter table public.messaging_paused enable row level security;
revoke all on public.messaging_paused from anon, authenticated;

-- Message email alerts: on by default; one-click off with a private token.
create table if not exists public.email_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  message_emails boolean not null default true,
  token uuid not null unique default gen_random_uuid()
);
alter table public.email_prefs enable row level security;
revoke all on public.email_prefs from anon, authenticated;

create table if not exists public.message_emails_sent (
  conversation_id bigint not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  sent_at timestamptz not null default now()
);
create index if not exists message_emails_sent_idx on public.message_emails_sent (conversation_id, user_id, sent_at desc);
alter table public.message_emails_sent enable row level security;
revoke all on public.message_emails_sent from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers (internal)
-- ---------------------------------------------------------------------------

create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks x
    where (x.blocker_id = a and x.blocked_id = b) or (x.blocker_id = b and x.blocked_id = a)
  );
$$;
revoke all on function public.is_blocked_between(uuid, uuid) from public, anon, authenticated;

-- Why a conversation is read-only for this person, or null if they can write.
create or replace function public.conversation_lock(c public.conversations, p_user uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when c.access_until <= now() then 'ended'
    when public.is_blocked_between(c.member_id, c.mentor_id) then 'blocked'
    when exists (select 1 from public.messaging_paused p where p.user_id = p_user) then 'paused'
    when c.mentor_id = p_user and not exists (select 1 from public.messages m where m.conversation_id = c.id) then 'member_first'
    else null
  end;
$$;
revoke all on function public.conversation_lock(public.conversations, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- For members
-- ---------------------------------------------------------------------------

create or replace function public.my_conversations()
returns table (
  id bigint, role text, other_name text, other_slug text, other_avatar text, other_title text,
  last_message text, last_message_mine boolean, last_message_at timestamptz,
  unread integer, access_until timestamptz, locked text, blocked_by_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    case when c.member_id = auth.uid() then 'member' else 'mentor' end,
    coalesce(p.full_name, 'Meetwell member'), p.slug, p.avatar_url, p.professional_title,
    left(lm.body, 140), lm.sender_id = auth.uid(), c.last_message_at,
    (select count(*)::integer from public.messages m
     where m.conversation_id = c.id and m.sender_id <> auth.uid()
       and m.created_at > coalesce(case when c.member_id = auth.uid() then c.member_read_at else c.mentor_read_at end, '-infinity')),
    c.access_until,
    public.conversation_lock(c, auth.uid()),
    exists (select 1 from public.blocks b where b.blocker_id = auth.uid()
            and b.blocked_id = case when c.member_id = auth.uid() then c.mentor_id else c.member_id end)
  from public.conversations c
  left join public.profiles p on p.user_id = case when c.member_id = auth.uid() then c.mentor_id else c.member_id end
  left join lateral (
    select m.body, m.sender_id from public.messages m where m.conversation_id = c.id order by m.created_at desc, m.id desc limit 1
  ) lm on true
  where auth.uid() in (c.member_id, c.mentor_id)
  order by coalesce(c.last_message_at, c.created_at) desc;
$$;
revoke all on function public.my_conversations() from public;
revoke execute on function public.my_conversations() from anon;
grant execute on function public.my_conversations() to authenticated;

create or replace function public.my_unread_messages()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum((
    select count(*) from public.messages m
    where m.conversation_id = c.id and m.sender_id <> auth.uid()
      and m.created_at > coalesce(case when c.member_id = auth.uid() then c.member_read_at else c.mentor_read_at end, '-infinity')
  )), 0)::integer
  from public.conversations c
  where auth.uid() in (c.member_id, c.mentor_id);
$$;
revoke all on function public.my_unread_messages() from public;
revoke execute on function public.my_unread_messages() from anon;
grant execute on function public.my_unread_messages() to authenticated;

-- The latest 200 messages of one of my conversations.
create or replace function public.my_messages(p_conversation bigint)
returns table (id bigint, mine boolean, body text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not exists (select 1 from public.conversations c where c.id = p_conversation and auth.uid() in (c.member_id, c.mentor_id)) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
    select x.id, x.mine, x.body, x.created_at from (
      select m.id, m.sender_id = auth.uid() as mine, m.body, m.created_at
      from public.messages m where m.conversation_id = p_conversation
      order by m.created_at desc, m.id desc limit 200
    ) x order by x.created_at, x.id;
end;
$$;
revoke all on function public.my_messages(bigint) from public;
revoke execute on function public.my_messages(bigint) from anon;
grant execute on function public.my_messages(bigint) to authenticated;

create or replace function public.mark_conversation_read(p_conversation bigint)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.conversations c set
    member_read_at = case when c.member_id = auth.uid() then now() else c.member_read_at end,
    mentor_read_at = case when c.mentor_id = auth.uid() then now() else c.mentor_read_at end
  where c.id = p_conversation and auth.uid() in (c.member_id, c.mentor_id);
$$;
revoke all on function public.mark_conversation_read(bigint) from public;
revoke execute on function public.mark_conversation_read(bigint) from anon;
grant execute on function public.mark_conversation_read(bigint) to authenticated;

create or replace function public.send_message(p_conversation bigint, p_body text)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  c public.conversations%rowtype;
  v_body text := btrim(coalesce(p_body, ''));
  v_lock text;
  v_id bigint;
begin
  select * into c from public.conversations x where x.id = p_conversation and v_user in (x.member_id, x.mentor_id) for update;
  if not found then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  v_lock := public.conversation_lock(c, v_user);
  if v_lock is not null then
    raise exception 'Locked: %', v_lock using errcode = '42501';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 2000 then
    raise exception 'Messages are 1 to 2,000 characters' using errcode = '22023';
  end if;
  if (select count(*) from public.messages m where m.sender_id = v_user and m.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Too many messages' using errcode = '54000';
  end if;
  insert into public.messages (conversation_id, sender_id, body) values (c.id, v_user, v_body) returning id into v_id;
  update public.conversations x set
    last_message_at = now(),
    member_read_at = case when x.member_id = v_user then now() else x.member_read_at end,
    mentor_read_at = case when x.mentor_id = v_user then now() else x.mentor_read_at end
  where x.id = c.id;
  return v_id;
end;
$$;
revoke all on function public.send_message(bigint, text) from public;
revoke execute on function public.send_message(bigint, text) from anon;
grant execute on function public.send_message(bigint, text) to authenticated;

-- Block or unblock the other person in one of my conversations.
create or replace function public.set_block(p_conversation bigint, p_blocked boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_other uuid;
begin
  select case when c.member_id = auth.uid() then c.mentor_id else c.member_id end into v_other
  from public.conversations c where c.id = p_conversation and auth.uid() in (c.member_id, c.mentor_id);
  if v_other is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_blocked then
    insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), v_other) on conflict do nothing;
  else
    delete from public.blocks where blocker_id = auth.uid() and blocked_id = v_other;
  end if;
end;
$$;
revoke all on function public.set_block(bigint, boolean) from public;
revoke execute on function public.set_block(bigint, boolean) from anon;
grant execute on function public.set_block(bigint, boolean) to authenticated;

-- Report a message the other person sent (once per message). Three open
-- reports against someone pause their messaging until an admin looks.
create or replace function public.report_message(p_message bigint, p_reason text, p_note text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_sender uuid;
begin
  select m.sender_id into v_sender
  from public.messages m join public.conversations c on c.id = m.conversation_id
  where m.id = p_message and auth.uid() in (c.member_id, c.mentor_id) and m.sender_id <> auth.uid();
  if v_sender is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  insert into public.message_reports (message_id, reporter_id, reported_id, reason, note)
  values (p_message, auth.uid(), v_sender, p_reason, nullif(left(btrim(coalesce(p_note, '')), 500), ''))
  on conflict (message_id, reporter_id) do nothing;
  if (select count(*) from public.message_reports r where r.reported_id = v_sender and r.status = 'open') >= 3 then
    insert into public.messaging_paused (user_id, reason) values (v_sender, 'Three open reports')
    on conflict (user_id) do nothing;
  end if;
end;
$$;
revoke all on function public.report_message(bigint, text, text) from public;
revoke execute on function public.report_message(bigint, text, text) from anon;
grant execute on function public.report_message(bigint, text, text) to authenticated;

-- Email alerts on or off for me.
create or replace function public.my_message_emails()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select e.message_emails from public.email_prefs e where e.user_id = auth.uid()), true);
$$;
revoke all on function public.my_message_emails() from public;
revoke execute on function public.my_message_emails() from anon;
grant execute on function public.my_message_emails() to authenticated;

create or replace function public.set_message_emails(p_on boolean)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.email_prefs (user_id, message_emails) values (auth.uid(), p_on)
  on conflict (user_id) do update set message_emails = excluded.message_emails;
$$;
revoke all on function public.set_message_emails(boolean) from public;
revoke execute on function public.set_message_emails(boolean) from anon;
grant execute on function public.set_message_emails(boolean) to authenticated;

-- One-click "turn off message emails" from an email (no login).
create or replace function public.unsubscribe_message_emails(p_token uuid)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  with done as (
    update public.email_prefs set message_emails = false where token = p_token returning 1
  )
  select exists (select 1 from done);
$$;
revoke all on function public.unsubscribe_message_emails(uuid) from public;
grant execute on function public.unsubscribe_message_emails(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- For the server (secret-protected): message email alerts
-- ---------------------------------------------------------------------------

-- After a message is sent: should the other person get an email? Yes if their
-- alerts are on, they haven't read it yet, and we haven't emailed them about this
-- conversation in the last 6 hours. Records the email so it's sent once.
create or replace function public.claim_message_email(p_token text, p_message bigint)
returns table (email text, full_name text, sender_name text, unsubscribe_token uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  m public.messages%rowtype;
  c public.conversations%rowtype;
  v_to uuid;
  v_read timestamptz;
begin
  perform public.check_cron_token(p_token);
  select * into m from public.messages x where x.id = p_message;
  if not found then return; end if;
  select * into c from public.conversations x where x.id = m.conversation_id;
  v_to := case when c.member_id = m.sender_id then c.mentor_id else c.member_id end;
  v_read := case when v_to = c.member_id then c.member_read_at else c.mentor_read_at end;
  if v_read is not null and v_read >= m.created_at then return; end if;
  insert into public.email_prefs (user_id) values (v_to) on conflict (user_id) do nothing;
  if not (select e.message_emails from public.email_prefs e where e.user_id = v_to) then return; end if;
  if exists (select 1 from public.message_emails_sent s
             where s.conversation_id = c.id and s.user_id = v_to and s.sent_at > now() - interval '6 hours') then
    return;
  end if;
  insert into public.message_emails_sent (conversation_id, user_id) values (c.id, v_to);
  return query
    select u.email::text, rp.full_name, coalesce(sp.full_name, 'A Meetwell member'), e.token
    from auth.users u
    join public.email_prefs e on e.user_id = u.id
    left join public.profiles rp on rp.user_id = u.id
    left join public.profiles sp on sp.user_id = m.sender_id
    where u.id = v_to;
end;
$$;
revoke all on function public.claim_message_email(text, bigint) from public;
-- Called by the server while the sender is logged in, so logged-in callers need
-- it too; the secret is what protects it.
grant execute on function public.claim_message_email(text, bigint) to anon, authenticated;

-- Fix: the Paystack return page runs while the member is logged in, so the
-- secret-protected payment functions must accept logged-in callers as well.
grant execute on function public.confirm_payment(text, text, integer, text, bigint) to authenticated;
grant execute on function public.mark_payment_failed(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- For admins
-- ---------------------------------------------------------------------------

-- Opens a conversation between a member (under 4 years) and a mentor (4+),
-- or extends access if they already have one. For testing before payments.
create or replace function public.admin_open_conversation(p_member_email text, p_mentor_email text, p_days integer)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_member uuid;
  v_mentor uuid;
  v_id bigint;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select u.id into v_member from auth.users u where lower(u.email) = lower(btrim(p_member_email));
  select u.id into v_mentor from auth.users u where lower(u.email) = lower(btrim(p_mentor_email));
  if v_member is null or v_mentor is null then
    raise exception 'No account with that email' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = v_mentor and p.experience_years >= 4) then
    raise exception 'The mentor needs 4+ years of experience' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = v_member and p.experience_years < 4) then
    raise exception 'The member needs under 4 years of experience' using errcode = '22023';
  end if;
  insert into public.conversations (member_id, mentor_id, access_until)
  values (v_member, v_mentor, now() + make_interval(days => greatest(least(coalesce(p_days, 30), 365), 1)))
  on conflict (member_id, mentor_id) do update set access_until = excluded.access_until
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.admin_open_conversation(text, text, integer) from public;
revoke execute on function public.admin_open_conversation(text, text, integer) from anon;
grant execute on function public.admin_open_conversation(text, text, integer) to authenticated;

-- Conversations for the admin page: who, when and how many messages. Never the messages.
create or replace function public.admin_list_conversations()
returns table (id bigint, member_email text, mentor_email text, messages integer, access_until timestamptz, last_message_at timestamptz)
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
    select c.id, mu.email::text, tu.email::text,
      (select count(*)::integer from public.messages m where m.conversation_id = c.id),
      c.access_until, c.last_message_at
    from public.conversations c
    join auth.users mu on mu.id = c.member_id
    join auth.users tu on tu.id = c.mentor_id
    order by c.created_at desc
    limit 200;
end;
$$;
revoke all on function public.admin_list_conversations() from public;
revoke execute on function public.admin_list_conversations() from anon;
grant execute on function public.admin_list_conversations() to authenticated;

-- Open and recent reports, with the reported message and up to 3 messages
-- either side of it, so the admin can judge it. Nothing else of the chat.
create or replace function public.admin_list_reports()
returns table (
  id bigint, reason text, note text, status text, created_at timestamptz,
  reporter_email text, reported_email text, reported_paused boolean, context jsonb
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
    select r.id, r.reason, r.note, r.status, r.created_at, ru.email::text, du.email::text,
      exists (select 1 from public.messaging_paused p where p.user_id = r.reported_id),
      (select jsonb_agg(jsonb_build_object(
          'reported', x.id = r.message_id, 'by_reported', x.sender_id = r.reported_id,
          'body', x.body, 'created_at', x.created_at) order by x.created_at, x.id)
       from (
         (select m.* from public.messages m join public.messages t on t.id = r.message_id
          where m.conversation_id = t.conversation_id and (m.created_at, m.id) <= (t.created_at, t.id)
          order by m.created_at desc, m.id desc limit 4)
         union all
         (select m.* from public.messages m join public.messages t on t.id = r.message_id
          where m.conversation_id = t.conversation_id and (m.created_at, m.id) > (t.created_at, t.id)
          order by m.created_at, m.id limit 3)
       ) x)
    from public.message_reports r
    join auth.users ru on ru.id = r.reporter_id
    join auth.users du on du.id = r.reported_id
    where r.status = 'open' or r.created_at > now() - interval '30 days'
    order by (r.status = 'open') desc, r.created_at desc
    limit 100;
end;
$$;
revoke all on function public.admin_list_reports() from public;
revoke execute on function public.admin_list_reports() from anon;
grant execute on function public.admin_list_reports() to authenticated;

-- Close a report: 'dismiss' (nothing wrong) or 'pause' (pause the reported person).
create or replace function public.admin_resolve_report(p_report bigint, p_action text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_reported uuid;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_action not in ('dismiss', 'pause') then
    raise exception 'Unknown action' using errcode = '22023';
  end if;
  update public.message_reports set status = case when p_action = 'pause' then 'actioned' else 'dismissed' end, resolved_at = now()
  where id = p_report returning reported_id into v_reported;
  if p_action = 'pause' then
    insert into public.messaging_paused (user_id, reason) values (v_reported, 'Paused by admin')
    on conflict (user_id) do nothing;
  end if;
end;
$$;
revoke all on function public.admin_resolve_report(bigint, text) from public;
revoke execute on function public.admin_resolve_report(bigint, text) from anon;
grant execute on function public.admin_resolve_report(bigint, text) to authenticated;

create or replace function public.admin_set_messaging_paused(p_email text, p_paused boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select u.id into v_user from auth.users u where lower(u.email) = lower(btrim(p_email));
  if v_user is null then
    raise exception 'No account with that email' using errcode = '22023';
  end if;
  if p_paused then
    insert into public.messaging_paused (user_id, reason) values (v_user, 'Paused by admin') on conflict (user_id) do nothing;
  else
    delete from public.messaging_paused where user_id = v_user;
  end if;
end;
$$;
revoke all on function public.admin_set_messaging_paused(text, boolean) from public;
revoke execute on function public.admin_set_messaging_paused(text, boolean) from anon;
grant execute on function public.admin_set_messaging_paused(text, boolean) to authenticated;
