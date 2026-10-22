-- Contacts: a member's own phone book of cards they've scanned or opened.
--
-- * Members who open someone's card while logged in keep it in Contacts.
-- * Visitors without an account keep a list on their own phone (browser
--   storage, never sent to us) and bring it along when they sign up.
-- * Opening a member's card counts as an invite during the private beta: the
--   visitor can sign up without an access code, up to 20 people per card.
-- * Card owners can see which members saved their card.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.saved_contacts (
  -- Deferred so the sign-up trigger can add rows for an account being created.
  user_id uuid not null references auth.users (id) on delete cascade deferrable initially deferred,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  source text not null default 'link' check (source in ('qr', 'link')),
  note text check (note is null or char_length(note) <= 300),
  saved_at timestamptz not null default now(),
  primary key (user_id, profile_id)
);
create index if not exists saved_contacts_profile_idx on public.saved_contacts (profile_id, saved_at desc);

alter table public.saved_contacts enable row level security;
revoke all on public.saved_contacts from anon, authenticated;

-- Who signed up through whose card (for the 20-per-card limit).
create table if not exists public.card_signups (
  user_id uuid primary key references auth.users (id) on delete cascade deferrable initially deferred,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists card_signups_profile_idx on public.card_signups (profile_id);

alter table public.card_signups enable row level security;
revoke all on public.card_signups from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Sign-up through a card
-- ---------------------------------------------------------------------------

-- A published member's card that still has invites left (20 sign-ups per card).
create or replace function public.card_invite_profile(p_slug text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.profiles p
  where p.slug = lower(btrim(coalesce(p_slug, '')))
    and p.status = 'published'
    and not public.is_admin_user(p.user_id)
    and (select count(*) from public.card_signups s where s.profile_id = p.id) < 20;
$$;
revoke all on function public.card_invite_profile(text) from public, anon, authenticated;

-- Lets the sign-up page say whether this card can still invite people.
create or replace function public.card_invite_open(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.card_invite_profile(p_slug) is not null;
$$;
revoke all on function public.card_invite_open(text) from public;
grant execute on function public.card_invite_open(text) to anon, authenticated;

-- New accounts need a valid access code, or the card of a member who still has
-- invites. Cards saved before signing up ("saved_cards" in the sign-up data)
-- go straight into the new member's Contacts, with the inviting card first.
create or replace function public.enforce_access_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_via uuid;
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
      if v_via is null then
        raise exception 'A valid access code is required to create an account';
      end if;
      insert into public.card_signups (user_id, profile_id) values (new.id, v_via);
    end if;
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
  new.raw_user_meta_data := v_meta - 'access_code' - 'via_card' - 'saved_cards';
  return new;
end;
$$;
revoke all on function public.enforce_access_code() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Contacts for members
-- ---------------------------------------------------------------------------

-- Keep a card in my Contacts (opening it while logged in, or bringing a list
-- from the phone). Unpublished cards and your own card are ignored.
create or replace function public.save_contact(p_slug text, p_source text default 'link')
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_profile uuid;
begin
  if v_user is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  select p.id into v_profile from public.profiles p
  where p.slug = lower(btrim(coalesce(p_slug, ''))) and p.status = 'published' and p.user_id <> v_user;
  if v_profile is null or public.is_admin_user(v_user) then
    return false;
  end if;
  insert into public.saved_contacts (user_id, profile_id, source)
  values (v_user, v_profile, case when p_source = 'qr' then 'qr' else 'link' end)
  on conflict do nothing;
  return true;
end;
$$;

-- My Contacts, newest first. Only cards that are still published.
create or replace function public.my_contacts()
returns table (
  slug text,
  full_name text,
  avatar_url text,
  professional_title text,
  organization text,
  note text,
  source text,
  saved_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.slug, p.full_name, p.avatar_url, p.professional_title, p.organization, c.note, c.source, c.saved_at
  from public.saved_contacts c
  join public.profiles p on p.id = c.profile_id and p.status = 'published'
  where c.user_id = auth.uid()
  order by c.saved_at desc;
$$;

create or replace function public.set_contact_note(p_slug text, p_note text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.saved_contacts c
     set note = nullif(left(btrim(coalesce(p_note, '')), 300), '')
    from public.profiles p
   where c.profile_id = p.id and p.slug = lower(btrim(coalesce(p_slug, ''))) and c.user_id = auth.uid();
$$;

create or replace function public.remove_contact(p_slug text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.saved_contacts c
   using public.profiles p
   where c.profile_id = p.id and p.slug = lower(btrim(coalesce(p_slug, ''))) and c.user_id = auth.uid();
$$;

-- Members who saved my card. Only people with a published card show, so the
-- owner can open it and save them back.
create or replace function public.who_saved_me()
returns table (
  slug text,
  full_name text,
  avatar_url text,
  professional_title text,
  organization text,
  saved_at timestamptz,
  saved_back boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select sp.slug, sp.full_name, sp.avatar_url, sp.professional_title, sp.organization, c.saved_at,
         exists (select 1 from public.saved_contacts b where b.user_id = auth.uid() and b.profile_id = sp.id)
  from public.profiles mine
  join public.saved_contacts c on c.profile_id = mine.id
  join public.profiles sp on sp.user_id = c.user_id and sp.status = 'published'
  where mine.user_id = auth.uid()
  order by c.saved_at desc;
$$;

revoke all on function public.save_contact(text, text) from public, anon;
revoke all on function public.my_contacts() from public, anon;
revoke all on function public.set_contact_note(text, text) from public, anon;
revoke all on function public.remove_contact(text) from public, anon;
revoke all on function public.who_saved_me() from public, anon;
grant execute on function public.save_contact(text, text) to authenticated;
grant execute on function public.my_contacts() to authenticated;
grant execute on function public.set_contact_note(text, text) to authenticated;
grant execute on function public.remove_contact(text) to authenticated;
grant execute on function public.who_saved_me() to authenticated;
