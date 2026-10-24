-- Partners step 3: event pages. One public page per partner event (/e/<slug>)
-- with every speaker's card, QR codes for badges and slides, and mentor
-- payments that start from the event page credited to the partner (10%, out of
-- Meetwell's 20%), so speakers already on Meetwell count too.
--
-- Credit rule: a payment carries the event it started from, but only when the
-- mentor is a speaker at that event. Such a payment earns the event's partner
-- 10%, whichever partner (if any) the mentor joined through, with no 12-month
-- limit. Payments without an event keep the step 2 rule.

create table if not exists public.partner_events (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$' and slug !~ '--'),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  starts_on date not null,
  ends_on date check (ends_on is null or ends_on >= starts_on),
  venue text check (venue is null or char_length(venue) <= 120),
  about text check (about is null or char_length(about) <= 600),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists partner_events_partner_idx on public.partner_events (partner_id, starts_on desc);
alter table public.partner_events enable row level security;
revoke all on public.partner_events from anon, authenticated;

create table if not exists public.event_speakers (
  event_id uuid not null references public.partner_events (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  sort integer not null default 0,
  added_at timestamptz not null default now(),
  primary key (event_id, profile_id)
);
alter table public.event_speakers enable row level security;
revoke all on public.event_speakers from anon, authenticated;

alter table public.payments add column if not exists event_id uuid references public.partner_events (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Public page
-- ---------------------------------------------------------------------------

-- An active event of an active partner, for /e/<slug>.
create or replace function public.public_event(p_slug text)
returns table (slug text, name text, starts_on date, ends_on date, venue text, about text, partner_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select e.slug, e.name, e.starts_on, e.ends_on, e.venue, e.about, pa.name
  from public.partner_events e
  join public.partners pa on pa.id = e.partner_id
  where e.slug = lower(p_slug) and e.active and pa.active;
$$;
revoke all on function public.public_event(text) from public;
grant execute on function public.public_event(text) to anon, authenticated;

-- The event's speakers: public card details of published cards only, with their
-- mentoring price when they take messages (null when they don't).
create or replace function public.public_event_speakers(p_slug text)
returns table (
  slug text, full_name text, title text, organization text, avatar_url text,
  price_kobo integer, years smallint
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.slug, p.full_name, p.professional_title, p.organization, p.avatar_url,
    case when m.status = 'approved' and m.accepting then m.price_kobo end,
    p.experience_years
  from public.partner_events e
  join public.partners pa on pa.id = e.partner_id and pa.active
  join public.event_speakers s on s.event_id = e.id
  join public.profiles p on p.id = s.profile_id and p.status = 'published'
  left join public.mentor_settings m on m.user_id = p.user_id
  where e.slug = lower(p_slug) and e.active
  order by s.sort, s.added_at;
$$;
revoke all on function public.public_event_speakers(text) from public;
grant execute on function public.public_event_speakers(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Payments started from an event page
-- ---------------------------------------------------------------------------

-- As before, plus the event the payment started from (kept only when the
-- mentor speaks at that active event).
drop function if exists public.start_subscription_purchase(text);
create function public.start_subscription_purchase(p_slug text, p_event text default null)
returns table (reference text, amount_kobo integer, email text, mentor_name text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_mentor uuid;
  v_profile uuid;
  v_price integer;
  v_name text;
  v_email text;
  v_ref text;
  v_event uuid;
begin
  if v_user is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select p.user_id, p.id, m.price_kobo, p.full_name into v_mentor, v_profile, v_price, v_name
  from public.profiles p join public.mentor_settings m on m.user_id = p.user_id
  where p.slug = lower(p_slug) and p.status = 'published' and m.status = 'approved' and m.accepting and m.price_kobo > 0;
  if v_mentor is null then
    raise exception 'Not taking paid messages' using errcode = '22023';
  end if;
  if v_mentor = v_user then
    raise exception 'That is you' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = v_user and p.experience_years < 4) then
    raise exception 'For members under 4 years of experience' using errcode = '42501';
  end if;
  if public.is_blocked_between(v_user, v_mentor) then
    raise exception 'Not available' using errcode = '42501';
  end if;
  if p_event is not null then
    select e.id into v_event
    from public.partner_events e
    join public.partners pa on pa.id = e.partner_id and pa.active
    join public.event_speakers s on s.event_id = e.id and s.profile_id = v_profile
    where e.slug = lower(p_event) and e.active;
  end if;
  select u.email::text into v_email from auth.users u where u.id = v_user;
  v_ref := 'mw_' || replace(gen_random_uuid()::text, '-', '');
  insert into public.payments (reference, user_id, kind, mentor_id, days, amount_kobo, mentor_share_kobo, event_id)
  values (v_ref, v_user, 'subscription', v_mentor, 30, v_price, (v_price * 80) / 100, v_event);
  return query select v_ref, v_price, v_email, v_name;
end;
$$;
revoke all on function public.start_subscription_purchase(text, text) from public;
revoke execute on function public.start_subscription_purchase(text, text) from anon;
grant execute on function public.start_subscription_purchase(text, text) to authenticated;

-- The partner's share: the event's partner when the payment started from an
-- event page; otherwise the partner the mentor joined through, for 12 months.
create or replace function public.partner_share_on_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_partner uuid;
  v_since timestamptz;
  v_share integer;
begin
  if new.kind <> 'subscription' or new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'success' then
    v_share := round(new.amount_kobo * 0.10);
    if new.event_id is not null then
      select e.partner_id into v_partner from public.partner_events e where e.id = new.event_id;
    else
      select s.partner_id, s.created_at into v_partner, v_since
      from public.partner_signups s where s.user_id = new.mentor_id;
      if v_partner is not null and coalesce(new.paid_at, now()) >= v_since + interval '12 months' then
        v_partner := null;
      end if;
    end if;
    if v_partner is not null and v_share > 0 then
      insert into public.partner_ledger (partner_id, amount_kobo, kind, payment_id, available_at)
      values (v_partner, v_share, 'earning', new.id, now() + interval '7 days')
      on conflict do nothing;
    end if;
  elsif new.status = 'refunded' then
    insert into public.partner_ledger (partner_id, amount_kobo, kind, payment_id)
    select l.partner_id, -l.amount_kobo, 'refund', new.id
    from public.partner_ledger l where l.payment_id = new.id and l.kind = 'earning'
    on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.partner_share_on_payment() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------

create or replace function public.admin_create_event(
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
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select id into v_partner from public.partners where slug = lower(p_partner_slug);
  if v_partner is null then
    raise exception 'No such partner' using errcode = '22023';
  end if;
  insert into public.partner_events (partner_id, slug, name, starts_on, ends_on, venue, about)
  values (v_partner, lower(btrim(p_slug)), btrim(p_name), p_starts_on, p_ends_on,
          nullif(btrim(coalesce(p_venue, '')), ''), nullif(btrim(coalesce(p_about, '')), ''))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.admin_create_event(text, text, text, date, date, text, text) from public;
revoke execute on function public.admin_create_event(text, text, text, date, date, text, text) from anon;
grant execute on function public.admin_create_event(text, text, text, date, date, text, text) to authenticated;

create or replace function public.admin_set_event_active(p_event_slug text, p_active boolean)
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
  update public.partner_events set active = p_active where slug = lower(p_event_slug);
end;
$$;
revoke all on function public.admin_set_event_active(text, boolean) from public;
revoke execute on function public.admin_set_event_active(text, boolean) from anon;
grant execute on function public.admin_set_event_active(text, boolean) to authenticated;

-- Add a speaker by their account email or card link name. Returns their name.
create or replace function public.admin_add_event_speaker(p_event_slug text, p_who text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_event uuid;
  v_profile uuid;
  v_name text;
  v_who text := lower(btrim(regexp_replace(coalesce(p_who, ''), '^.*/p/', '')));
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select id into v_event from public.partner_events where slug = lower(p_event_slug);
  if v_event is null then
    raise exception 'No such event' using errcode = '22023';
  end if;
  select p.id, p.full_name into v_profile, v_name
  from public.profiles p left join auth.users u on u.id = p.user_id
  where p.slug = v_who or lower(u.email) = v_who
  limit 1;
  if v_profile is null then
    raise exception 'No card found for that email or link' using errcode = '22023';
  end if;
  insert into public.event_speakers (event_id, profile_id, sort)
  values (v_event, v_profile, (select coalesce(max(sort), 0) + 1 from public.event_speakers where event_id = v_event))
  on conflict do nothing;
  return v_name;
end;
$$;
revoke all on function public.admin_add_event_speaker(text, text) from public;
revoke execute on function public.admin_add_event_speaker(text, text) from anon;
grant execute on function public.admin_add_event_speaker(text, text) to authenticated;

create or replace function public.admin_remove_event_speaker(p_event_slug text, p_profile_slug text)
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
  delete from public.event_speakers s
  using public.partner_events e, public.profiles p
  where s.event_id = e.id and s.profile_id = p.id and e.slug = lower(p_event_slug) and p.slug = lower(p_profile_slug);
end;
$$;
revoke all on function public.admin_remove_event_speaker(text, text) from public;
revoke execute on function public.admin_remove_event_speaker(text, text) from anon;
grant execute on function public.admin_remove_event_speaker(text, text) to authenticated;

-- A partner's events, with speakers and the paid messages they brought in.
create or replace function public.admin_partner_events(p_partner_slug text)
returns table (
  slug text, name text, starts_on date, ends_on date, venue text, about text, active boolean,
  speakers jsonb, payments integer, revenue_kobo integer
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
    select e.slug, e.name, e.starts_on, e.ends_on, e.venue, e.about, e.active,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'slug', p.slug, 'full_name', p.full_name, 'status', p.status::text,
          'mentor', (m.status = 'approved')
        ) order by s.sort, s.added_at)
        from public.event_speakers s
        join public.profiles p on p.id = s.profile_id
        left join public.mentor_settings m on m.user_id = p.user_id
        where s.event_id = e.id
      ), '[]'::jsonb),
      (select count(*)::integer from public.payments y where y.event_id = e.id and y.status = 'success'),
      (select coalesce(sum(y.amount_kobo), 0)::integer from public.payments y where y.event_id = e.id and y.status = 'success')
    from public.partner_events e
    join public.partners pa on pa.id = e.partner_id
    where pa.slug = lower(p_partner_slug)
    order by e.starts_on desc, e.created_at desc;
end;
$$;
revoke all on function public.admin_partner_events(text) from public;
revoke execute on function public.admin_partner_events(text) from anon;
grant execute on function public.admin_partner_events(text) to authenticated;

-- Partner teams see their own events (same access as their Partner tab).
create or replace function public.my_partner_events()
returns table (partner_name text, slug text, name text, starts_on date, active boolean, speakers integer)
language sql
stable
security definer
set search_path = ''
as $$
  select pa.name, e.slug, e.name, e.starts_on, e.active,
    (select count(*)::integer from public.event_speakers s where s.event_id = e.id)
  from public.partner_members pm
  join public.partners pa on pa.id = pm.partner_id
  join public.partner_events e on e.partner_id = pa.id
  where pm.user_id = auth.uid()
  order by e.starts_on desc;
$$;
revoke all on function public.my_partner_events() from public;
revoke execute on function public.my_partner_events() from anon;
grant execute on function public.my_partner_events() to authenticated;
