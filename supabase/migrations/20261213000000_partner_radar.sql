-- Partner radar: Lagos and online events found about two weeks ahead, so the
-- founder can ask organisers about Meetwell joining as a partner. Moved here
-- from a claude.ai page (November 2026).
--
-- Admin only. Nothing here sends email: the page drafts the partner email and
-- the one follow-up, and the founder sends them himself from hello@meetwell.me.
-- New finds come from the weekly search through radar_import_events(), which
-- needs the cron secret, or are added by hand on the page.

create table if not exists public.radar_events (
  -- A readable id, date plus name ('2026-11-12-neclive-2026'), so a weekly
  -- search that finds the same event again doesn't add it twice
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  start_date date not null,
  end_date date,
  category text check (category is null or char_length(category) <= 60),
  format text not null default 'in person' check (format in ('in person', 'online')),
  venue text check (venue is null or char_length(venue) <= 200),
  organizer text check (organizer is null or char_length(organizer) <= 200),
  link text check (link is null or (char_length(link) <= 500 and link ~ '^https?://')),
  contact text check (contact is null or char_length(contact) <= 200),
  -- Why Meetwell fits, and the event's own lines for the partner email
  angle text check (angle is null or char_length(angle) <= 1000),
  hook text check (hook is null or char_length(hook) <= 1000),
  idea text check (idea is null or char_length(idea) <= 1500),
  offer text check (offer is null or char_length(offer) <= 1500),
  subject text check (subject is null or char_length(subject) <= 200),
  status text not null default 'new' check (status in ('new', 'contacted', 'talking', 'agreed', 'declined')),
  notes text check (notes is null or char_length(notes) <= 4000),
  source text not null default 'manual' check (source in ('manual', 'weekly-search')),
  found_on date not null default (now() at time zone 'Africa/Lagos')::date,
  -- The 3-day follow-up clock starts the first time it's marked Contacted
  contacted_on date,
  followed_up_on date,
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

-- The founder's pitch, written once and dropped into every partner email
create table if not exists public.radar_pitch (
  id boolean primary key default true check (id),
  pitch text not null default '' check (char_length(pitch) <= 2000),
  offer text not null default '' check (char_length(offer) <= 2000),
  sender text not null default '' check (char_length(sender) <= 200),
  updated_at timestamptz not null default now()
);
insert into public.radar_pitch (id) values (true) on conflict (id) do nothing;

alter table public.radar_events enable row level security;
alter table public.radar_pitch enable row level security;
revoke all on public.radar_events from anon, authenticated;
revoke all on public.radar_pitch from anon, authenticated;

-- Every event, soonest first
create or replace function public.admin_list_radar()
returns setof public.radar_events
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query select * from public.radar_events r order by r.start_date, r.name;
end;
$$;

create or replace function public.admin_get_radar_pitch()
returns table (pitch text, offer text, sender text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query select p.pitch, p.offer, p.sender from public.radar_pitch p where p.id;
end;
$$;

create or replace function public.admin_set_radar_pitch(p_pitch text, p_offer text, p_sender text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  insert into public.radar_pitch (id, pitch, offer, sender, updated_at)
  values (true, btrim(coalesce(p_pitch, '')), btrim(coalesce(p_offer, '')), btrim(coalesce(p_sender, '')), now())
  on conflict (id) do update
    set pitch = excluded.pitch, offer = excluded.offer, sender = excluded.sender, updated_at = now();
end;
$$;

-- Turns a date and a name into the event's id
create or replace function public.radar_event_id(p_start date, p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(regexp_replace(regexp_replace(lower(p_start::text || '-' || coalesce(p_name, '')), '[^a-z0-9]+', '-', 'g'), '-+$', ''), 80);
$$;

-- Add an event by hand. Returns its id.
create or replace function public.admin_add_radar_event(
  p_name text, p_start date, p_end date, p_category text, p_format text,
  p_venue text, p_organizer text, p_link text, p_contact text, p_angle text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text := public.radar_event_id(p_start, btrim(coalesce(p_name, '')));
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if exists (select 1 from public.radar_events where id = v_id) then
    raise exception 'That event is already on the radar' using errcode = '23505';
  end if;
  insert into public.radar_events (id, name, start_date, end_date, category, format, venue, organizer, link, contact, angle, source)
  values (v_id, btrim(p_name), p_start, coalesce(p_end, p_start), nullif(btrim(coalesce(p_category, '')), ''),
          coalesce(nullif(p_format, ''), 'in person'), nullif(btrim(coalesce(p_venue, '')), ''),
          nullif(btrim(coalesce(p_organizer, '')), ''), nullif(btrim(coalesce(p_link, '')), ''),
          nullif(btrim(coalesce(p_contact, '')), ''), nullif(btrim(coalesce(p_angle, '')), ''), 'manual');
  return v_id;
end;
$$;

-- Move an event along. The first time it's marked Contacted starts the follow-up clock.
create or replace function public.admin_set_radar_status(p_id text, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.radar_events
     set status = p_status,
         contacted_on = case when p_status = 'contacted' then coalesce(contacted_on, (now() at time zone 'Africa/Lagos')::date) else contacted_on end,
         updated_at = now()
   where id = p_id;
  if not found then
    raise exception 'Not found' using errcode = 'P0002';
  end if;
end;
$$;

-- Notes and the organiser's email address, both editable on the page
create or replace function public.admin_set_radar_details(p_id text, p_notes text, p_contact text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.radar_events
     set notes = nullif(btrim(coalesce(p_notes, '')), ''),
         contact = nullif(btrim(coalesce(p_contact, '')), ''),
         updated_at = now()
   where id = p_id;
  if not found then
    raise exception 'Not found' using errcode = 'P0002';
  end if;
end;
$$;

-- The one follow-up was sent
create or replace function public.admin_mark_radar_followed_up(p_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.radar_events
     set followed_up_on = coalesce(followed_up_on, (now() at time zone 'Africa/Lagos')::date), updated_at = now()
   where id = p_id;
  if not found then
    raise exception 'Not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.admin_delete_radar_event(p_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  delete from public.radar_events where id = p_id;
end;
$$;

-- The weekly search adds its finds here (cron secret). An event already on the
-- radar is left as it is, so its stage and notes are never overwritten.
-- Returns how many were new.
create or replace function public.radar_import_events(p_token text, p_events jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
  v_added integer;
begin
  select s.value into v_secret from public.internal_settings s where s.key = 'cron_secret';
  if v_secret is null or char_length(v_secret) < 32 or p_token is distinct from v_secret then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(p_events) is distinct from 'array' or jsonb_array_length(p_events) > 100 then
    raise exception 'Send a list of up to 100 events' using errcode = '22023';
  end if;

  with incoming as (
    select e,
           coalesce(nullif(e->>'id', ''), public.radar_event_id((e->>'start')::date, e->>'name')) as id
    from jsonb_array_elements(p_events) e
  ), added as (
    insert into public.radar_events (id, name, start_date, end_date, category, format, venue, organizer, link,
                                     contact, angle, hook, idea, offer, subject, source, found_on)
    select i.id, btrim(i.e->>'name'), (i.e->>'start')::date, coalesce((i.e->>'end')::date, (i.e->>'start')::date),
           nullif(i.e->>'category', ''), coalesce(nullif(i.e->>'format', ''), 'in person'), nullif(i.e->>'venue', ''),
           nullif(i.e->>'organizer', ''), nullif(i.e->>'link', ''), nullif(i.e->>'contact', ''), nullif(i.e->>'angle', ''),
           nullif(i.e->>'hook', ''), nullif(i.e->>'idea', ''), nullif(i.e->>'offer', ''), nullif(i.e->>'subject', ''),
           'weekly-search', coalesce((i.e->>'found')::date, (now() at time zone 'Africa/Lagos')::date)
    from incoming i
    on conflict (id) do nothing
    returning 1
  )
  select count(*) into v_added from added;
  return v_added;
end;
$$;

revoke all on function public.admin_list_radar() from public, anon;
revoke all on function public.admin_get_radar_pitch() from public, anon;
revoke all on function public.admin_set_radar_pitch(text, text, text) from public, anon;
revoke all on function public.admin_add_radar_event(text, date, date, text, text, text, text, text, text, text) from public, anon;
revoke all on function public.admin_set_radar_status(text, text) from public, anon;
revoke all on function public.admin_set_radar_details(text, text, text) from public, anon;
revoke all on function public.admin_mark_radar_followed_up(text) from public, anon;
revoke all on function public.admin_delete_radar_event(text) from public, anon;
revoke all on function public.radar_import_events(text, jsonb) from public, authenticated;
grant execute on function public.admin_list_radar() to authenticated;
grant execute on function public.admin_get_radar_pitch() to authenticated;
grant execute on function public.admin_set_radar_pitch(text, text, text) to authenticated;
grant execute on function public.admin_add_radar_event(text, date, date, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.admin_set_radar_status(text, text) to authenticated;
grant execute on function public.admin_set_radar_details(text, text, text) to authenticated;
grant execute on function public.admin_mark_radar_followed_up(text) to authenticated;
grant execute on function public.admin_delete_radar_event(text) to authenticated;
-- The import is called by the server with the cron secret, like claim_reminders
grant execute on function public.radar_import_events(text, jsonb) to anon;
