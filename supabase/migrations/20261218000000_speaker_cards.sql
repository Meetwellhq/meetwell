-- Speaker cards: a partner's team (or an admin) uploads a spreadsheet of their
-- speakers, and each speaker gets a public card on Meetwell without needing an
-- account, shown on the event page with Save contact and a badge QR code.
--
-- Consent: the uploader confirms every speaker on the list agreed to their
-- details being shown (kept: who and when). Phone and WhatsApp show only for
-- rows marked "show phone". Each speaker with an email is told by email, with a
-- link to claim the card (sign up with their own access code: the details carry
-- over into their account and their real card replaces this one) and a link to
-- remove it in one click.
--
-- Claiming reuses speaker invites (20261217000000_event_speaker_invites.sql):
-- the card's email gets an invite with its own code, marked as already emailed
-- so only the speaker card email goes out.

create table if not exists public.speaker_cards (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.partner_events (id) on delete cascade,
  -- Its page is /s/<slug> (separate from member cards at /p/<slug>).
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' and slug !~ '--'),
  full_name text not null check (char_length(btrim(full_name)) between 1 and 80),
  title text check (title is null or char_length(title) <= 100),
  organization text check (organization is null or char_length(organization) <= 100),
  bio text check (bio is null or char_length(bio) <= 500),
  photo_url text check (photo_url is null or (photo_url ~* '^https://' and char_length(photo_url) <= 500)),
  email text check (email is null or (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254)),
  phone text check (phone is null or phone ~ '^\+?[0-9 ()-]{7,20}$'),
  whatsapp text check (whatsapp is null or whatsapp ~ '^\+?[0-9 ()-]{7,20}$'),
  show_phone boolean not null default false,
  linkedin text check (linkedin is null or (linkedin ~* '^https://' and char_length(linkedin) <= 300)),
  x text check (x is null or (x ~* '^https://' and char_length(x) <= 300)),
  instagram text check (instagram is null or (instagram ~* '^https://' and char_length(instagram) <= 300)),
  facebook text check (facebook is null or (facebook ~* '^https://' and char_length(facebook) <= 300)),
  tiktok text check (tiktok is null or (tiktok ~* '^https://' and char_length(tiktok) <= 300)),
  website text check (website is null or (website ~* '^https?://' and char_length(website) <= 300)),
  sort integer not null default 0,
  -- The claim code (an access code) and the private link to remove the card.
  code text,
  remove_token uuid not null default gen_random_uuid() unique,
  consent_by uuid,
  consent_at timestamptz not null default now(),
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists speaker_cards_event_idx on public.speaker_cards (event_id, sort);
create unique index if not exists speaker_cards_event_email_idx on public.speaker_cards (event_id, email) where email is not null;
alter table public.speaker_cards enable row level security;
revoke all on public.speaker_cards from anon, authenticated;

-- "Ada Obi" → "ada-obi", then "ada-obi-2", … until free.
create or replace function public.speaker_card_slug(p_name text)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_base text := left(trim(both '-' from regexp_replace(regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]+', '-', 'g'), '-+', '-', 'g')), 34);
  v_slug text;
  n integer := 1;
begin
  v_base := trim(both '-' from v_base);
  if char_length(v_base) < 3 then v_base := 'speaker'; end if;
  v_slug := v_base;
  while exists (select 1 from public.speaker_cards where slug = v_slug) loop
    n := n + 1;
    v_slug := v_base || '-' || n;
  end loop;
  return v_slug;
end;
$$;
revoke all on function public.speaker_card_slug(text) from public, anon, authenticated;

-- Add speaker cards from a spreadsheet, up to 300 at a time and 1,000 per event.
-- p_consent must be true: the uploader confirms every speaker agreed.
-- One row back per person:
--   created       new speaker card, live on the event page
--   member_added  already has a Meetwell card: added as a speaker instead
--   duplicate     this email already has a speaker card on the event
--   bad           no name, or details that don't fit (say which in the app)
create or replace function public.add_speaker_cards(p_event_slug text, p_cards jsonb, p_consent boolean)
returns table (full_name text, email text, slug text, outcome text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_event uuid := public.manageable_event(p_event_slug);
  v_ends date;
  v_card jsonb;
  v_name text;
  v_email text;
  v_profile uuid;
  v_profile_slug text;
  v_slug text;
  v_code text;
  v_count integer;
begin
  if v_event is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_consent is not true then
    raise exception 'Confirm the speakers agreed to their details being shown' using errcode = '22023';
  end if;
  if jsonb_typeof(p_cards) is distinct from 'array' or jsonb_array_length(p_cards) not between 1 and 300 then
    raise exception 'Send between 1 and 300 speakers at a time' using errcode = '22023';
  end if;
  select count(*) into v_count from public.speaker_cards where event_id = v_event;
  if v_count + jsonb_array_length(p_cards) > 1000 then
    raise exception 'An event can have up to 1,000 speaker cards' using errcode = '22023';
  end if;
  select coalesce(ends_on, starts_on) into v_ends from public.partner_events where id = v_event;

  for v_card in select * from jsonb_array_elements(p_cards) loop
    v_name := nullif(left(btrim(regexp_replace(coalesce(v_card ->> 'name', ''), '\s+', ' ', 'g')), 80), '');
    v_email := nullif(lower(btrim(coalesce(v_card ->> 'email', ''))), '');
    v_slug := null;
    v_profile := null;
    if v_name is null then
      return query select v_name, v_email, null::text, 'bad'::text;
      continue;
    end if;

    if v_email is not null then
      if exists (select 1 from public.speaker_cards c where c.event_id = v_event and c.email = v_email) then
        return query select v_name, v_email, null::text, 'duplicate'::text;
        continue;
      end if;
      -- Already a member with a card: make them a speaker, nothing more.
      select p.id, p.slug into v_profile, v_profile_slug
      from auth.users u join public.profiles p on p.user_id = u.id
      where lower(u.email) = v_email limit 1;
      if v_profile is not null then
        insert into public.event_speakers (event_id, profile_id, sort)
        values (v_event, v_profile, (select coalesce(max(sort), 0) + 1 from public.event_speakers where event_id = v_event))
        on conflict do nothing;
        return query select v_name, v_email, v_profile_slug, 'member_added'::text;
        continue;
      end if;
    end if;

    begin
      v_slug := public.speaker_card_slug(v_name);
      v_code := null;
      if v_email is not null then
        -- Their claim code, through a speaker invite (no invite email: this card's email says it).
        v_code := 'SPK-' || upper(substr(md5(gen_random_uuid()::text), 1, 10));
        insert into public.access_codes (code, max_uses, note, expires_at)
        values (v_code, 1, left('Speaker card: ' || v_email, 200),
                greatest(now(), (v_ends + 1)::timestamp at time zone 'Africa/Lagos') + interval '90 days');
        insert into public.event_speaker_invites (event_id, email, full_name, code, invited_by, emailed_at, reminded_at)
        values (v_event, v_email, v_name, v_code, auth.uid(), now(), now())
        on conflict (event_id, email) do update set code = excluded.code, emailed_at = now(), reminded_at = now();
      end if;
      insert into public.speaker_cards (
        event_id, slug, full_name, title, organization, bio, photo_url, email, phone, whatsapp, show_phone,
        linkedin, x, instagram, facebook, tiktok, website, sort, code, consent_by
      ) values (
        v_event, v_slug, v_name,
        nullif(left(btrim(coalesce(v_card ->> 'title', '')), 100), ''),
        nullif(left(btrim(coalesce(v_card ->> 'organization', '')), 100), ''),
        nullif(left(btrim(coalesce(v_card ->> 'bio', '')), 500), ''),
        nullif(btrim(coalesce(v_card ->> 'photo', '')), ''),
        v_email,
        nullif(btrim(coalesce(v_card ->> 'phone', '')), ''),
        nullif(btrim(coalesce(v_card ->> 'whatsapp', '')), ''),
        coalesce((v_card ->> 'show_phone')::boolean, false),
        nullif(btrim(coalesce(v_card ->> 'linkedin', '')), ''),
        nullif(btrim(coalesce(v_card ->> 'x', '')), ''),
        nullif(btrim(coalesce(v_card ->> 'instagram', '')), ''),
        nullif(btrim(coalesce(v_card ->> 'facebook', '')), ''),
        nullif(btrim(coalesce(v_card ->> 'tiktok', '')), ''),
        nullif(btrim(coalesce(v_card ->> 'website', '')), ''),
        (select coalesce(max(sort), 0) + 1 from public.speaker_cards where event_id = v_event),
        v_code, auth.uid()
      );
      return query select v_name, v_email, v_slug, 'created'::text;
    exception when check_violation or invalid_text_representation then
      return query select v_name, v_email, null::text, 'bad'::text;
    end;
  end loop;
end;
$$;
revoke all on function public.add_speaker_cards(text, jsonb, boolean) from public, anon;
grant execute on function public.add_speaker_cards(text, jsonb, boolean) to authenticated;

-- The event's speaker cards, for its team.
create or replace function public.event_speaker_cards_list(p_event_slug text)
returns table (slug text, full_name text, title text, organization text, email text, show_phone boolean, emailed_at timestamptz)
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
    select c.slug, c.full_name, c.title, c.organization, c.email, c.show_phone, c.emailed_at
    from public.speaker_cards c where c.event_id = v_event order by c.sort, c.created_at;
end;
$$;
revoke all on function public.event_speaker_cards_list(text) from public, anon;
grant execute on function public.event_speaker_cards_list(text) to authenticated;

-- Removing a card also takes back its claim code.
create or replace function public.drop_speaker_card(p_card uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_card public.speaker_cards;
begin
  delete from public.speaker_cards where id = p_card returning * into v_card;
  if v_card.id is null then return null; end if;
  if v_card.email is not null then
    delete from public.event_speaker_invites
     where event_id = v_card.event_id and email = v_card.email and user_id is null;
  end if;
  if v_card.code is not null then
    update public.access_codes set expires_at = now() where code = v_card.code and uses = 0;
  end if;
  return v_card.full_name;
end;
$$;
revoke all on function public.drop_speaker_card(uuid) from public, anon, authenticated;

create or replace function public.remove_speaker_card(p_event_slug text, p_slug text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_event uuid := public.manageable_event(p_event_slug);
begin
  if v_event is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  perform public.drop_speaker_card(c.id) from public.speaker_cards c where c.event_id = v_event and c.slug = lower(p_slug);
end;
$$;
revoke all on function public.remove_speaker_card(text, text) from public, anon;
grant execute on function public.remove_speaker_card(text, text) to authenticated;

-- The speaker's own one-click removal, from the link in their email. Anyone with
-- the link can do it, so it only ever deletes. Returns their name, or null.
create or replace function public.remove_speaker_card_by_token(p_token uuid)
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select public.drop_speaker_card(c.id) from public.speaker_cards c where c.remove_token = p_token;
$$;
revoke all on function public.remove_speaker_card_by_token(uuid) from public;
grant execute on function public.remove_speaker_card_by_token(uuid) to anon, authenticated;

-- Public: one speaker card (/s/<slug>), on an active event of an active partner.
-- Phone and WhatsApp only when the row said to show them.
create or replace function public.public_speaker_card(p_slug text)
returns table (
  slug text, full_name text, title text, organization text, bio text, photo_url text,
  email text, phone text, whatsapp text, linkedin text, x text, instagram text, facebook text, tiktok text, website text,
  created_at timestamptz, event_slug text, event_name text, partner_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.slug, c.full_name, c.title, c.organization, c.bio, c.photo_url, c.email,
    case when c.show_phone then c.phone end, case when c.show_phone then c.whatsapp end,
    c.linkedin, c.x, c.instagram, c.facebook, c.tiktok, c.website,
    c.created_at, e.slug, e.name, pa.name
  from public.speaker_cards c
  join public.partner_events e on e.id = c.event_id and e.active
  join public.partners pa on pa.id = e.partner_id and pa.active
  where c.slug = lower(p_slug);
$$;
revoke all on function public.public_speaker_card(text) from public;
grant execute on function public.public_speaker_card(text) to anon, authenticated;

-- Public: an event's speaker cards, for the event page (after member speakers).
create or replace function public.public_event_speaker_cards(p_slug text)
returns table (slug text, full_name text, title text, organization text, photo_url text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.slug, c.full_name, c.title, c.organization, c.photo_url
  from public.partner_events e
  join public.partners pa on pa.id = e.partner_id and pa.active
  join public.speaker_cards c on c.event_id = e.id
  where e.slug = lower(p_slug) and e.active
  order by c.sort, c.created_at;
$$;
revoke all on function public.public_event_speaker_cards(text) from public;
grant execute on function public.public_event_speaker_cards(text) to anon, authenticated;

-- For the server (cron secret): speaker card emails not sent yet, for one event
-- or (null) any event not over. Each is handed out once.
create or replace function public.claim_speaker_card_emails(p_token text, p_event_slug text, p_limit integer)
returns table (
  email text, full_name text, slug text, code text, remove_token uuid, show_phone boolean,
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
    select c.id
    from public.speaker_cards c
    join public.partner_events e on e.id = c.event_id
    where c.emailed_at is null and c.email is not null
      and (p_event_slug is null or e.slug = lower(p_event_slug))
      and coalesce(e.ends_on, e.starts_on) >= (now() at time zone 'Africa/Lagos')::date
    order by c.created_at
    limit least(greatest(coalesce(p_limit, 40), 1), 100)
    for update of c skip locked
  ), marked as (
    update public.speaker_cards c set emailed_at = now()
    from due where c.id = due.id
    returning c.*
  )
  select m.email, m.full_name, m.slug, m.code, m.remove_token, m.show_phone,
    e.name, e.slug, e.starts_on, e.ends_on, e.venue, pa.name
  from marked m
  join public.partner_events e on e.id = m.event_id
  join public.partners pa on pa.id = e.partner_id;
end;
$$;
revoke all on function public.claim_speaker_card_emails(text, text, integer) from public;
grant execute on function public.claim_speaker_card_emails(text, text, integer) to anon, authenticated;

-- How many speaker card emails for an event are still waiting.
create or replace function public.speaker_card_emails_waiting(p_event_slug text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.speaker_cards c
  where c.event_id = public.manageable_event(p_event_slug) and c.emailed_at is null and c.email is not null;
$$;
revoke all on function public.speaker_card_emails_waiting(text) from public, anon;
grant execute on function public.speaker_card_emails_waiting(text) to authenticated;

-- Claiming: when an invited speaker's card is made, the speaker card's details
-- fill the empty parts of it, then the speaker card goes (their real card is on
-- the event now). Replaces the version from the invites migration.
create or replace function public.join_speaker_invites()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite record;
  v_card public.speaker_cards;
begin
  for v_invite in
    update public.event_speaker_invites
       set joined_at = now()
     where user_id = new.user_id and joined_at is null
    returning event_id, email
  loop
    insert into public.event_speakers (event_id, profile_id, sort)
    values (v_invite.event_id, new.id, (select coalesce(max(sort), 0) + 1 from public.event_speakers where event_id = v_invite.event_id))
    on conflict do nothing;
    insert into public.event_speaker_emails (event_id, profile_id) values (v_invite.event_id, new.id) on conflict do nothing;

    select * into v_card from public.speaker_cards c where c.event_id = v_invite.event_id and c.email = v_invite.email;
    if v_card.id is not null then
      update public.profiles p
         set professional_title = coalesce(nullif(p.professional_title, ''), v_card.title),
             organization = coalesce(nullif(p.organization, ''), v_card.organization),
             bio = coalesce(nullif(p.bio, ''), v_card.bio),
             avatar_url = coalesce(p.avatar_url, v_card.photo_url),
             website_url = coalesce(p.website_url, v_card.website)
       where p.id = new.id;
      insert into public.contact_methods (profile_id, type, value, is_public, sort_order)
      select new.id, t.type::public.contact_type, t.value, t.public, t.ord
      from (values ('email', v_card.email, true, 0), ('phone', v_card.phone, v_card.show_phone, 1), ('whatsapp', v_card.whatsapp, v_card.show_phone, 2))
        as t(type, value, public, ord)
      where t.value is not null
        and not exists (select 1 from public.contact_methods m where m.profile_id = new.id and m.type = t.type::public.contact_type);
      insert into public.social_links (profile_id, platform, url, sort_order)
      select new.id, s.platform, s.url, s.ord
      from (values ('linkedin', v_card.linkedin, 0), ('x', v_card.x, 1), ('instagram', v_card.instagram, 2),
                   ('facebook', v_card.facebook, 3), ('tiktok', v_card.tiktok, 4)) as s(platform, url, ord)
      where s.url is not null
        and not exists (select 1 from public.social_links l where l.profile_id = new.id and l.platform = s.platform);
      delete from public.speaker_cards where id = v_card.id;
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function public.join_speaker_invites() from public, anon, authenticated;
