-- Partners (step 1: links and tracking, no money yet). An event platform such
-- as ThinkUX gets an invite link, meetwell.me/join?partner=<slug>. People who
-- sign up through it count as "joined through" that partner, for good, and the
-- link works as an invite during the private beta (up to max_signups people).
-- People on the partner's team (partner_members) see a partner page with who
-- joined through them: public card details only, never private fields,
-- messages or earnings. A later step adds the partner's share of mentor
-- payments (out of Meetwell's 20%; mentors keep 80%).

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' and slug !~ '--'),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  max_signups integer not null default 200 check (max_signups between 0 and 100000),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.partners enable row level security;
revoke all on public.partners from anon, authenticated;

-- Accounts that can see a partner's page (the partner's own team).
create table if not exists public.partner_members (
  partner_id uuid not null references public.partners (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (partner_id, user_id)
);
alter table public.partner_members enable row level security;
revoke all on public.partner_members from anon, authenticated;

-- Who joined through which partner. One partner per account, set at sign-up.
create table if not exists public.partner_signups (
  -- Deferred so the sign-up trigger can add the row for an account being created.
  user_id uuid primary key references auth.users (id) on delete cascade deferrable initially deferred,
  partner_id uuid not null references public.partners (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists partner_signups_partner_idx on public.partner_signups (partner_id, created_at desc);
alter table public.partner_signups enable row level security;
revoke all on public.partner_signups from anon, authenticated;

-- The partner a link points to, while it's active and has room.
create or replace function public.partner_invite_id(p_slug text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select pa.id
  from public.partners pa
  where pa.slug = lower(btrim(coalesce(p_slug, '')))
    and pa.active
    and (select count(*) from public.partner_signups s where s.partner_id = pa.id) < pa.max_signups;
$$;
revoke all on function public.partner_invite_id(text) from public, anon, authenticated;

-- For the join page: the partner's name if its link can still invite people.
create or replace function public.partner_invite_name(p_slug text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select pa.name from public.partners pa where pa.id = public.partner_invite_id(p_slug);
$$;
revoke all on function public.partner_invite_name(text) from public;
grant execute on function public.partner_invite_name(text) to anon, authenticated;

-- New accounts need a valid access code, a member's card with invites left,
-- or an active partner link. A partner link is recorded whichever let them in.
create or replace function public.enforce_access_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_via uuid;
  v_partner uuid := public.partner_invite_id(v_meta ->> 'via_partner');
  v_slug text;
begin
  if public.invite_only() then
    update public.access_codes
       set uses = uses + 1
     where code = public.normalize_access_code(v_meta ->> 'access_code')
       and uses < max_uses
       and (expires_at is null or expires_at > now());
    if not found then
      v_via := public.card_invite_profile(v_meta ->> 'via_card');
      if v_via is not null then
        insert into public.card_signups (user_id, profile_id) values (new.id, v_via);
      elsif v_partner is null then
        raise exception 'A valid access code is required to create an account';
      end if;
    end if;
  end if;

  if v_partner is not null then
    insert into public.partner_signups (user_id, partner_id) values (new.id, v_partner) on conflict do nothing;
  end if;

  if v_meta ? 'via_card' then
    insert into public.saved_contacts (user_id, profile_id, source)
    select new.id, p.id, 'qr' from public.profiles p
    where p.slug = lower(btrim(v_meta ->> 'via_card')) and p.status = 'published'
    on conflict do nothing;
  end if;
  if jsonb_typeof(v_meta -> 'saved_cards') = 'array' then
    for v_slug in select jsonb_array_elements_text(v_meta -> 'saved_cards') limit 50 loop
      insert into public.saved_contacts (user_id, profile_id, source)
      select new.id, p.id, 'link' from public.profiles p
      where p.slug = lower(btrim(v_slug)) and p.status = 'published'
      on conflict do nothing;
    end loop;
  end if;

  -- Don't keep any of this on the user record.
  new.raw_user_meta_data := v_meta - 'access_code' - 'via_card' - 'saved_cards' - 'via_partner';
  return new;
end;
$$;
revoke all on function public.enforce_access_code() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------

create or replace function public.admin_create_partner(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  insert into public.partners (name, slug) values (btrim(p_name), lower(btrim(p_slug))) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.admin_create_partner(text, text) from public;
revoke execute on function public.admin_create_partner(text, text) from anon;
grant execute on function public.admin_create_partner(text, text) to authenticated;

-- Every partner with its numbers and the emails of its team.
create or replace function public.admin_list_partners()
returns table (
  id uuid, slug text, name text, active boolean, max_signups integer, created_at timestamptz,
  signups integer, published integer, mentors integer, team text[]
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
    select pa.id, pa.slug, pa.name, pa.active, pa.max_signups, pa.created_at,
      (select count(*)::integer from public.partner_signups s where s.partner_id = pa.id),
      (select count(*)::integer from public.partner_signups s
         join public.profiles p on p.user_id = s.user_id
        where s.partner_id = pa.id and p.status = 'published'),
      (select count(*)::integer from public.partner_signups s
         join public.mentor_settings m on m.user_id = s.user_id
        where s.partner_id = pa.id and m.status = 'approved'),
      coalesce((select array_agg(u.email::text order by u.email) from public.partner_members pm
         join auth.users u on u.id = pm.user_id where pm.partner_id = pa.id), '{}')
    from public.partners pa
    order by pa.created_at desc;
end;
$$;
revoke all on function public.admin_list_partners() from public;
revoke execute on function public.admin_list_partners() from anon;
grant execute on function public.admin_list_partners() to authenticated;

-- Give someone on the partner's team access to its page. They need a Meetwell
-- account first. Returns false if there's no account with that email.
create or replace function public.admin_add_partner_member(p_partner uuid, p_email text)
returns boolean
language plpgsql
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
    return false;
  end if;
  insert into public.partner_members (partner_id, user_id) values (p_partner, v_user) on conflict do nothing;
  return true;
end;
$$;
revoke all on function public.admin_add_partner_member(uuid, text) from public;
revoke execute on function public.admin_add_partner_member(uuid, text) from anon;
grant execute on function public.admin_add_partner_member(uuid, text) to authenticated;

create or replace function public.admin_set_partner_active(p_partner uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.partners set active = p_active where id = p_partner;
end;
$$;
revoke all on function public.admin_set_partner_active(uuid, boolean) from public;
revoke execute on function public.admin_set_partner_active(uuid, boolean) from anon;
grant execute on function public.admin_set_partner_active(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- The partner's own page
-- ---------------------------------------------------------------------------

-- Partners I'm on the team of (usually one).
create or replace function public.my_partners()
returns table (id uuid, slug text, name text, active boolean, max_signups integer, signups integer)
language sql
stable
security definer
set search_path = ''
as $$
  select pa.id, pa.slug, pa.name, pa.active, pa.max_signups,
    (select count(*)::integer from public.partner_signups s where s.partner_id = pa.id)
  from public.partners pa
  join public.partner_members pm on pm.partner_id = pa.id
  where pm.user_id = auth.uid()
  order by pa.name;
$$;
revoke all on function public.my_partners() from public;
revoke execute on function public.my_partners() from anon;
grant execute on function public.my_partners() to authenticated;

-- People who joined through one of my partners, newest first. Public card
-- details only, and only once their card is published; before that just
-- "setting up" with no name.
create or replace function public.partner_people(p_partner uuid)
returns table (
  joined_at timestamptz, published boolean, mentor boolean,
  slug text, full_name text, avatar_url text, professional_title text, organization text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not exists (select 1 from public.partner_members pm where pm.partner_id = p_partner and pm.user_id = auth.uid()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
    select s.created_at,
      coalesce(p.status = 'published', false),
      exists (select 1 from public.mentor_settings m where m.user_id = s.user_id and m.status = 'approved'),
      case when p.status = 'published' then p.slug end,
      case when p.status = 'published' then p.full_name end,
      case when p.status = 'published' then p.avatar_url end,
      case when p.status = 'published' then p.professional_title end,
      case when p.status = 'published' then p.organization end
    from public.partner_signups s
    left join public.profiles p on p.user_id = s.user_id
    where s.partner_id = p_partner
    order by s.created_at desc
    limit 500;
end;
$$;
revoke all on function public.partner_people(uuid) from public;
revoke execute on function public.partner_people(uuid) from anon;
grant execute on function public.partner_people(uuid) to authenticated;
