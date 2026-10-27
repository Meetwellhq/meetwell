-- Partner teams manage their own event pages from the Partner tab: create an
-- event (live at once), edit it, and add or remove speakers. Deleting and
-- hiding events stay with admins.
--
-- Speakers are added straight away, as from admin. Partners never see a
-- speaker's email: the "you're a speaker" email address comes from
-- claim_event_speaker_email, which only the server can call (cron secret) and
-- which hands it out once per speaker per event (kept even if they are removed
-- and added again, so nobody can be emailed over and over).

create table if not exists public.event_speaker_emails (
  event_id uuid not null references public.partner_events (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (event_id, profile_id)
);
alter table public.event_speaker_emails enable row level security;
revoke all on public.event_speaker_emails from anon, authenticated;

-- The partner (id) behind an event, when the caller is on that partner's team.
create or replace function public.my_event_partner(p_event_slug text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.partner_id
  from public.partner_events e
  join public.partner_members pm on pm.partner_id = e.partner_id and pm.user_id = auth.uid()
  where e.slug = lower(p_event_slug);
$$;
revoke all on function public.my_event_partner(text) from public, anon, authenticated;

create or replace function public.partner_create_event(
  p_partner_slug text, p_slug text, p_name text, p_starts_on date,
  p_ends_on date default null, p_venue text default null, p_about text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_partner uuid;
  v_id uuid;
begin
  select pa.id into v_partner
  from public.partners pa
  join public.partner_members pm on pm.partner_id = pa.id and pm.user_id = auth.uid()
  where pa.slug = lower(p_partner_slug) and pa.active;
  if v_partner is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  insert into public.partner_events (partner_id, slug, name, starts_on, ends_on, venue, about)
  values (v_partner, lower(btrim(p_slug)), btrim(p_name), p_starts_on, p_ends_on,
          nullif(btrim(coalesce(p_venue, '')), ''), nullif(btrim(coalesce(p_about, '')), ''))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.partner_create_event(text, text, text, date, date, text, text) from public;
revoke execute on function public.partner_create_event(text, text, text, date, date, text, text) from anon;
grant execute on function public.partner_create_event(text, text, text, date, date, text, text) to authenticated;

-- Same fields as admin_update_event; the link name stays (QR codes may be printed).
create or replace function public.partner_update_event(
  p_event_slug text, p_name text, p_starts_on date,
  p_ends_on date default null, p_venue text default null, p_about text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if public.my_event_partner(p_event_slug) is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.partner_events
     set name = btrim(p_name),
         starts_on = p_starts_on,
         ends_on = p_ends_on,
         venue = nullif(btrim(coalesce(p_venue, '')), ''),
         about = nullif(btrim(coalesce(p_about, '')), '')
   where slug = lower(p_event_slug);
end;
$$;
revoke all on function public.partner_update_event(text, text, date, date, text, text) from public;
revoke execute on function public.partner_update_event(text, text, date, date, text, text) from anon;
grant execute on function public.partner_update_event(text, text, date, date, text, text) to authenticated;

-- Add a speaker by account email or card link. Like the admin version, minus the email address.
create or replace function public.partner_add_event_speaker(p_event_slug text, p_who text)
returns table (full_name text, profile_slug text, card_status text, added boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_event uuid;
  v_profile uuid;
  v_who text := lower(btrim(regexp_replace(coalesce(p_who, ''), '^.*/p/', '')));
  v_added boolean;
begin
  if public.my_event_partner(p_event_slug) is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select id into v_event from public.partner_events where slug = lower(p_event_slug);
  select p.id into v_profile
  from public.profiles p left join auth.users u on u.id = p.user_id
  where p.slug = v_who or lower(u.email) = v_who
  limit 1;
  if v_profile is null then
    raise exception 'No card found for that email or link' using errcode = '22023';
  end if;
  insert into public.event_speakers (event_id, profile_id, sort)
  values (v_event, v_profile, (select coalesce(max(sort), 0) + 1 from public.event_speakers where event_id = v_event))
  on conflict do nothing;
  v_added := found;
  return query select p.full_name, p.slug, p.status::text, v_added from public.profiles p where p.id = v_profile;
end;
$$;
revoke all on function public.partner_add_event_speaker(text, text) from public;
revoke execute on function public.partner_add_event_speaker(text, text) from anon;
grant execute on function public.partner_add_event_speaker(text, text) to authenticated;

create or replace function public.partner_remove_event_speaker(p_event_slug text, p_profile_slug text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if public.my_event_partner(p_event_slug) is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  delete from public.event_speakers s
  using public.partner_events e, public.profiles p
  where s.event_id = e.id and s.profile_id = p.id and e.slug = lower(p_event_slug) and p.slug = lower(p_profile_slug);
end;
$$;
revoke all on function public.partner_remove_event_speaker(text, text) from public;
revoke execute on function public.partner_remove_event_speaker(text, text) from anon;
grant execute on function public.partner_remove_event_speaker(text, text) to authenticated;

-- For the server only (cron secret): what the "you're a speaker" email needs,
-- once per speaker per event. Nothing comes back the second time.
create or replace function public.claim_event_speaker_email(p_token text, p_event_slug text, p_profile_slug text)
returns table (
  email text, full_name text, card_status text,
  event_name text, starts_on date, ends_on date, venue text, partner_name text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_event uuid;
  v_profile uuid;
begin
  perform public.check_cron_token(p_token);
  select s.event_id, s.profile_id into v_event, v_profile
  from public.event_speakers s
  join public.partner_events e on e.id = s.event_id
  join public.profiles p on p.id = s.profile_id
  where e.slug = lower(p_event_slug) and p.slug = lower(p_profile_slug);
  if v_event is null then return; end if;
  insert into public.event_speaker_emails (event_id, profile_id) values (v_event, v_profile) on conflict do nothing;
  if not found then return; end if;
  return query
    select u.email::text, p.full_name, p.status::text, e.name, e.starts_on, e.ends_on, e.venue, pa.name
    from public.profiles p
    join auth.users u on u.id = p.user_id
    join public.partner_events e on e.id = v_event
    join public.partners pa on pa.id = e.partner_id
    where p.id = v_profile;
end;
$$;
revoke all on function public.claim_event_speaker_email(text, text, text) from public;
grant execute on function public.claim_event_speaker_email(text, text, text) to anon, authenticated;

-- Admins adding a speaker (and emailing them) count as the one email too.
create or replace function public.admin_add_event_speaker_details(p_event_slug text, p_who text)
returns table (
  full_name text, email text, profile_slug text, card_status text, added boolean,
  event_name text, starts_on date, ends_on date, venue text, partner_name text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_event uuid;
  v_profile uuid;
  v_who text := lower(btrim(regexp_replace(coalesce(p_who, ''), '^.*/p/', '')));
  v_added boolean;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select id into v_event from public.partner_events where slug = lower(p_event_slug);
  if v_event is null then
    raise exception 'No such event' using errcode = '22023';
  end if;
  select p.id into v_profile
  from public.profiles p left join auth.users u on u.id = p.user_id
  where p.slug = v_who or lower(u.email) = v_who
  limit 1;
  if v_profile is null then
    raise exception 'No card found for that email or link' using errcode = '22023';
  end if;
  insert into public.event_speakers (event_id, profile_id, sort)
  values (v_event, v_profile, (select coalesce(max(sort), 0) + 1 from public.event_speakers where event_id = v_event))
  on conflict do nothing;
  v_added := found;
  -- The app emails them now, so a partner adding them again later sends nothing.
  if v_added then
    insert into public.event_speaker_emails (event_id, profile_id) values (v_event, v_profile) on conflict do nothing;
  end if;
  return query
    select p.full_name, u.email::text, p.slug, p.status::text, v_added,
           e.name, e.starts_on, e.ends_on, e.venue, pa.name
    from public.profiles p
    join auth.users u on u.id = p.user_id
    join public.partner_events e on e.id = v_event
    join public.partners pa on pa.id = e.partner_id
    where p.id = v_profile;
end;
$$;
revoke all on function public.admin_add_event_speaker_details(text, text) from public;
revoke execute on function public.admin_add_event_speaker_details(text, text) from anon;
grant execute on function public.admin_add_event_speaker_details(text, text) to authenticated;

-- The Partner tab's event list, now with what editing needs: the partner's
-- link name, all the event's details and its speakers. Same columns as before
-- first, so the app version still running keeps working.
drop function if exists public.my_partner_events();
create function public.my_partner_events()
returns table (
  partner_name text, slug text, name text, starts_on date, active boolean, speakers integer, conversations integer,
  partner_slug text, ends_on date, venue text, about text, speaker_list jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select pa.name, e.slug, e.name, e.starts_on, e.active,
    (select count(*)::integer from public.event_speakers s where s.event_id = e.id),
    (select count(*)::integer from public.conversations c where c.event_id = e.id)
      + (select count(*)::integer from public.payments y where y.event_id = e.id and y.status = 'success'),
    pa.slug, e.ends_on, e.venue, e.about,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', p.slug, 'full_name', p.full_name, 'status', p.status::text,
        'mentor', coalesce(m.status = 'approved', false)
      ) order by s.sort, s.added_at)
      from public.event_speakers s
      join public.profiles p on p.id = s.profile_id
      left join public.mentor_settings m on m.user_id = p.user_id
      where s.event_id = e.id
    ), '[]'::jsonb)
  from public.partner_members pm
  join public.partners pa on pa.id = pm.partner_id
  join public.partner_events e on e.partner_id = pa.id
  where pm.user_id = auth.uid()
  order by e.starts_on desc;
$$;
revoke all on function public.my_partner_events() from public;
revoke execute on function public.my_partner_events() from anon;
grant execute on function public.my_partner_events() to authenticated;
