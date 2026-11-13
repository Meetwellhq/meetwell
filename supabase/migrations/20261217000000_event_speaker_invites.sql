-- Speaker invites: a partner's team (or an admin) pastes a list of names and
-- emails for an event, and Meetwell invites them all at once.
--
-- - Someone who already has a card is added to the event straight away.
-- - Everyone else gets their own single-use access code, emailed by Meetwell
--   ("Tech Hub has invited you to speak at …"). Signing up with that code, or
--   with the invited email address, links the new account to the invite, and
--   making their card adds them to the event's speakers.
-- - One reminder goes out 3 days later to anyone who hasn't joined yet, until
--   the event is over.
--
-- The team sees the emails they typed in (it's their list) and each person's
-- progress. Emails go out from the server only (cron secret), each once.

create table if not exists public.event_speaker_invites (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.partner_events (id) on delete cascade,
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  full_name text check (full_name is null or char_length(btrim(full_name)) between 1 and 80),
  code text not null,
  invited_by uuid,
  created_at timestamptz not null default now(),
  emailed_at timestamptz,
  reminded_at timestamptz,
  -- The account that took the invite (an existing one, or the one made with it).
  -- No foreign key: it is set while auth.users is still inserting the row.
  user_id uuid,
  joined_at timestamptz,
  unique (event_id, email)
);
create index if not exists event_speaker_invites_user_idx on public.event_speaker_invites (user_id) where joined_at is null;
create index if not exists event_speaker_invites_code_idx on public.event_speaker_invites (code);
alter table public.event_speaker_invites enable row level security;
revoke all on public.event_speaker_invites from anon, authenticated;

-- The event's id when the caller is on its partner's team or is an admin.
create or replace function public.manageable_event(p_event_slug text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id
  from public.partner_events e
  where e.slug = lower(p_event_slug)
    and (public.is_admin() or exists (
      select 1 from public.partner_members pm where pm.partner_id = e.partner_id and pm.user_id = auth.uid()
    ));
$$;
revoke all on function public.manageable_event(text) from public, anon, authenticated;

-- Invite a list of people: [{"name": "Ada Obi", "email": "ada@x.com"}, …], up to 300 at a time
-- and 1,000 per event. One row back per person: what happened to them.
--   added            already had a card: now a speaker
--   already_speaker  already a speaker
--   invited          new invite, email waiting to go out
--   already_invited  invited before (nothing changes)
--   no_card          has an account but no card yet: joins the event when they make it
--   bad_email        not an email address
create or replace function public.invite_event_speakers(p_event_slug text, p_people jsonb)
returns table (email text, full_name text, outcome text, profile_slug text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_event uuid := public.manageable_event(p_event_slug);
  v_ends date;
  v_person jsonb;
  v_email text;
  v_name text;
  v_user uuid;
  v_profile uuid;
  v_slug text;
  v_code text;
  v_count integer;
begin
  if v_event is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(p_people) is distinct from 'array' or jsonb_array_length(p_people) not between 1 and 300 then
    raise exception 'Send between 1 and 300 people at a time' using errcode = '22023';
  end if;
  select count(*) into v_count from public.event_speaker_invites where event_id = v_event;
  if v_count + jsonb_array_length(p_people) > 1000 then
    raise exception 'An event can have up to 1,000 invites' using errcode = '22023';
  end if;
  select coalesce(ends_on, starts_on) into v_ends from public.partner_events where id = v_event;

  for v_person in select * from jsonb_array_elements(p_people) loop
    v_email := lower(btrim(coalesce(v_person ->> 'email', '')));
    v_name := nullif(left(btrim(regexp_replace(coalesce(v_person ->> 'name', ''), '\s+', ' ', 'g')), 80), '');
    v_profile := null;
    v_slug := null;

    if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
      return query select v_email, v_name, 'bad_email'::text, null::text;
      continue;
    end if;
    if exists (select 1 from public.event_speaker_invites i where i.event_id = v_event and i.email = v_email) then
      return query select v_email, v_name, 'already_invited'::text, null::text;
      continue;
    end if;

    select u.id into v_user from auth.users u where lower(u.email) = v_email limit 1;
    if v_user is not null then
      select p.id, p.slug into v_profile, v_slug from public.profiles p where p.user_id = v_user;
    end if;

    if v_profile is not null then
      insert into public.event_speakers (event_id, profile_id, sort)
      values (v_event, v_profile, (select coalesce(max(sort), 0) + 1 from public.event_speakers where event_id = v_event))
      on conflict do nothing;
      return query select v_email, v_name, case when found then 'added' else 'already_speaker' end, v_slug;
      continue;
    end if;

    -- Their own code: works once, until 30 days after the event (at least 30 days from now).
    v_code := 'SPK-' || upper(substr(md5(gen_random_uuid()::text), 1, 10));
    insert into public.access_codes (code, max_uses, note, expires_at)
    values (v_code, 1, left('Speaker invite: ' || v_email, 200),
            greatest(now(), (v_ends + 1)::timestamp at time zone 'Africa/Lagos') + interval '30 days');
    insert into public.event_speaker_invites (event_id, email, full_name, code, invited_by, user_id)
    values (v_event, v_email, v_name, v_code, auth.uid(), v_user);
    return query select v_email, v_name, case when v_user is null then 'invited' else 'no_card' end, null::text;
  end loop;
end;
$$;
revoke all on function public.invite_event_speakers(text, jsonb) from public, anon;
grant execute on function public.invite_event_speakers(text, jsonb) to authenticated;

-- Everyone invited to an event and how far they got, newest first.
create or replace function public.event_speaker_invites_list(p_event_slug text)
returns table (email text, full_name text, status text, emailed_at timestamptz, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_event uuid := public.manageable_event(p_event_slug);
begin
  if v_event is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
    select i.email, i.full_name,
      case
        when i.joined_at is not null then 'joined'
        when i.user_id is not null then 'signed_up'
        when i.emailed_at is null then 'waiting'
        else 'invited'
      end,
      i.emailed_at, i.created_at
    from public.event_speaker_invites i
    where i.event_id = v_event
    order by i.created_at desc, i.email;
end;
$$;
revoke all on function public.event_speaker_invites_list(text) from public, anon;
grant execute on function public.event_speaker_invites_list(text) to authenticated;

-- Take back an invite (a typo, or someone who isn't speaking after all). Their
-- code stops working unless they already used it; a card already on the event stays.
create or replace function public.cancel_event_speaker_invite(p_event_slug text, p_email text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_event uuid := public.manageable_event(p_event_slug);
  v_code text;
begin
  if v_event is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  delete from public.event_speaker_invites
   where event_id = v_event and email = lower(btrim(p_email))
  returning code into v_code;
  if v_code is not null then
    update public.access_codes set expires_at = now() where code = v_code and uses = 0;
  end if;
end;
$$;
revoke all on function public.cancel_event_speaker_invite(text, text) from public, anon;
grant execute on function public.cancel_event_speaker_invite(text, text) to authenticated;

-- How many invites to an event are still waiting for their email.
create or replace function public.event_speaker_invites_waiting(p_event_slug text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.event_speaker_invites i
  where i.event_id = public.manageable_event(p_event_slug) and i.emailed_at is null and i.user_id is null;
$$;
revoke all on function public.event_speaker_invites_waiting(text) from public, anon;
grant execute on function public.event_speaker_invites_waiting(text) to authenticated;

-- For the server (cron secret): invites whose email hasn't gone out yet, for one
-- event or (null) any event that isn't over. Each is handed out once.
create or replace function public.claim_speaker_invite_emails(p_token text, p_event_slug text, p_limit integer)
returns table (
  email text, full_name text, code text,
  event_name text, event_slug text, starts_on date, ends_on date, venue text, partner_name text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.check_cron_token(p_token);
  return query
  with due as (
    select i.id
    from public.event_speaker_invites i
    join public.partner_events e on e.id = i.event_id
    where i.emailed_at is null and i.user_id is null
      and (p_event_slug is null or e.slug = lower(p_event_slug))
      and coalesce(e.ends_on, e.starts_on) >= (now() at time zone 'Africa/Lagos')::date
    order by i.created_at
    limit least(greatest(coalesce(p_limit, 40), 1), 100)
    for update of i skip locked
  ), marked as (
    update public.event_speaker_invites i set emailed_at = now()
    from due where i.id = due.id
    returning i.*
  )
  select m.email, m.full_name, m.code, e.name, e.slug, e.starts_on, e.ends_on, e.venue, pa.name
  from marked m
  join public.partner_events e on e.id = m.event_id
  join public.partners pa on pa.id = e.partner_id;
end;
$$;
revoke all on function public.claim_speaker_invite_emails(text, text, integer) from public;
grant execute on function public.claim_speaker_invite_emails(text, text, integer) to anon, authenticated;

-- For the daily job: one reminder, 3 days after the invite, to anyone who hasn't
-- signed up, while the event is still ahead.
create or replace function public.claim_speaker_invite_reminders(p_token text, p_limit integer)
returns table (
  email text, full_name text, code text,
  event_name text, event_slug text, starts_on date, ends_on date, venue text, partner_name text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.check_cron_token(p_token);
  return query
  with due as (
    select i.id
    from public.event_speaker_invites i
    join public.partner_events e on e.id = i.event_id
    where i.emailed_at <= now() - interval '3 days'
      and i.reminded_at is null and i.user_id is null
      and e.starts_on >= (now() at time zone 'Africa/Lagos')::date
    order by i.emailed_at
    limit least(greatest(coalesce(p_limit, 40), 1), 100)
    for update of i skip locked
  ), marked as (
    update public.event_speaker_invites i set reminded_at = now()
    from due where i.id = due.id
    returning i.*
  )
  select m.email, m.full_name, m.code, e.name, e.slug, e.starts_on, e.ends_on, e.venue, pa.name
  from marked m
  join public.partner_events e on e.id = m.event_id
  join public.partners pa on pa.id = e.partner_id;
end;
$$;
revoke all on function public.claim_speaker_invite_reminders(text, integer) from public;
grant execute on function public.claim_speaker_invite_reminders(text, integer) to anon, authenticated;

-- Sign-up: link the new account to their invite, by the code they used or the
-- invited email. Someone invited by email who arrives without a code gets their
-- invite's code, so the access-code check lets them in. Runs before
-- auth_users_require_access_code (triggers fire in name order).
create or replace function public.link_speaker_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_code text := public.normalize_access_code(v_meta ->> 'access_code');
  v_invite_code text;
begin
  update public.event_speaker_invites
     set user_id = new.id
   where user_id is null
     and (code = v_code or email = lower(coalesce(new.email, '')));

  if v_code = '' then
    select i.code into v_invite_code
    from public.event_speaker_invites i
    join public.access_codes c on c.code = i.code
    where i.user_id = new.id and c.uses < c.max_uses and (c.expires_at is null or c.expires_at > now())
    limit 1;
    if v_invite_code is not null then
      new.raw_user_meta_data := v_meta || jsonb_build_object('access_code', v_invite_code);
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.link_speaker_invite() from public, anon, authenticated;

drop trigger if exists auth_users_a_speaker_invite on auth.users;
create trigger auth_users_a_speaker_invite
  before insert on auth.users
  for each row execute function public.link_speaker_invite();

-- Their card exists: they're a speaker now. They had the invite email, so the
-- "you're a speaker" email is counted as sent.
create or replace function public.join_speaker_invites()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event uuid;
begin
  for v_event in
    update public.event_speaker_invites
       set joined_at = now()
     where user_id = new.user_id and joined_at is null
    returning event_id
  loop
    insert into public.event_speakers (event_id, profile_id, sort)
    values (v_event, new.id, (select coalesce(max(sort), 0) + 1 from public.event_speakers where event_id = v_event))
    on conflict do nothing;
    insert into public.event_speaker_emails (event_id, profile_id) values (v_event, new.id) on conflict do nothing;
  end loop;
  return new;
end;
$$;
revoke all on function public.join_speaker_invites() from public, anon, authenticated;

drop trigger if exists profiles_join_speaker_invites on public.profiles;
create trigger profiles_join_speaker_invites
  after insert on public.profiles
  for each row execute function public.join_speaker_invites();
