-- Meetwell: initial schema
-- Profiles, contact methods, social links, privacy-conscious aggregate events,
-- row-level security, public read RPCs and the avatar storage bucket.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.profile_status as enum ('draft', 'published', 'unpublished');
create type public.contact_type as enum ('email', 'phone', 'whatsapp');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  slug text not null unique
    check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' and slug !~ '--'),
  full_name text not null check (char_length(btrim(full_name)) between 1 and 80),
  avatar_url text check (avatar_url is null or (avatar_url ~* '^https?://' and char_length(avatar_url) <= 500)),
  professional_title text check (char_length(professional_title) <= 100),
  organization text check (char_length(organization) <= 100),
  bio text check (char_length(bio) <= 500),
  website_url text check (website_url is null or (website_url ~* '^https?://' and char_length(website_url) <= 300)),
  website_is_public boolean not null default true,
  networking_goals text[] not null default '{}'
    check (
      networking_goals <@ array[
        'collaborators', 'clients', 'mentors', 'mentees',
        'jobs', 'hiring', 'investors', 'friends'
      ]::text[]
    ),
  status public.profile_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

comment on table public.profiles is 'One networking card per user. Read publicly only through get_public_profile().';
comment on column public.profiles.published_at is 'First publish time. Once set, the slug is locked so printed QR codes keep working.';

create table public.contact_methods (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  type public.contact_type not null,
  value text not null check (char_length(btrim(value)) between 3 and 200),
  label text check (char_length(label) <= 40),
  is_public boolean not null default false,
  sort_order smallint not null default 0
);

create index contact_methods_profile_idx on public.contact_methods (profile_id, sort_order);

create table public.social_links (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (
    platform in (
      'linkedin', 'x', 'instagram', 'github', 'dribbble', 'behance',
      'youtube', 'tiktok', 'facebook', 'threads', 'medium', 'substack', 'other'
    )
  ),
  url text not null check (url ~* '^https://' and char_length(url) <= 300),
  is_public boolean not null default true,
  sort_order smallint not null default 0
);

create index social_links_profile_idx on public.social_links (profile_id, sort_order);

-- Aggregate engagement counters. No IP address, user agent, cookie or visitor
-- identifier is stored: only which profile, what happened, and when.
create table public.profile_events (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  event_type text not null check (
    event_type in (
      'view', 'save_contact', 'email_click', 'phone_click',
      'website_click', 'social_click', 'copy_message'
    )
  ),
  source text check (source in ('qr', 'link')),
  created_at timestamptz not null default now()
);

create index profile_events_profile_created_idx on public.profile_events (profile_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.profiles_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();

  if tg_op = 'UPDATE' then
    if new.user_id <> old.user_id then
      raise exception 'Profile ownership cannot change';
    end if;
    if old.published_at is not null and new.slug <> old.slug then
      raise exception 'The profile link is permanent once published'
        using errcode = 'check_violation';
    end if;
    new.created_at := old.created_at;
    new.published_at := coalesce(old.published_at, new.published_at);
  end if;

  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;

  return new;
end;
$$;

create trigger profiles_before_write
before insert or update on public.profiles
for each row execute function public.profiles_before_write();

-- Cap child rows per profile so a single account cannot bloat the database.
create or replace function public.enforce_child_row_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  row_count int;
  max_rows int := tg_argv[0]::int;
begin
  execute format('select count(*) from %I.%I where profile_id = $1', tg_table_schema, tg_table_name)
    into row_count
    using new.profile_id;
  if row_count >= max_rows then
    raise exception 'Too many % for this profile (max %)', tg_table_name, max_rows
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger contact_methods_limit
before insert on public.contact_methods
for each row execute function public.enforce_child_row_limit('10');

create trigger social_links_limit
before insert on public.social_links
for each row execute function public.enforce_child_row_limit('12');

-- ---------------------------------------------------------------------------
-- Row-level security
-- Owners have full access to their own rows. Nobody else can read the base
-- tables; public pages go through the security-definer functions below, which
-- return only fields the owner marked public.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.contact_methods enable row level security;
alter table public.social_links enable row level security;
alter table public.profile_events enable row level security;

revoke all on public.profiles, public.contact_methods, public.social_links, public.profile_events from anon;
revoke all on public.profiles, public.contact_methods, public.social_links, public.profile_events from authenticated;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.contact_methods to authenticated;
grant select, insert, update, delete on public.social_links to authenticated;
grant select on public.profile_events to authenticated;

create policy "Owners read their profile" on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Owners create their profile" on public.profiles
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Owners update their profile" on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Owners delete their profile" on public.profiles
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "Owners manage their contact methods" on public.contact_methods
  for all to authenticated
  using (profile_id in (select id from public.profiles where user_id = (select auth.uid())))
  with check (profile_id in (select id from public.profiles where user_id = (select auth.uid())));

create policy "Owners manage their social links" on public.social_links
  for all to authenticated
  using (profile_id in (select id from public.profiles where user_id = (select auth.uid())))
  with check (profile_id in (select id from public.profiles where user_id = (select auth.uid())));

create policy "Owners read their profile events" on public.profile_events
  for select to authenticated
  using (profile_id in (select id from public.profiles where user_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- Public read API
-- ---------------------------------------------------------------------------

-- Returns the public view of a published profile, or null. This is the only
-- path by which non-owners read profile data (web, vCard and future mobile).
create or replace function public.get_public_profile(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'slug', p.slug,
    'fullName', p.full_name,
    'avatarUrl', p.avatar_url,
    'title', p.professional_title,
    'organization', p.organization,
    'bio', p.bio,
    'websiteUrl', case when p.website_is_public then p.website_url end,
    'networkingGoals', to_jsonb(p.networking_goals),
    'contacts', coalesce((
      select jsonb_agg(
        jsonb_build_object('type', c.type, 'value', c.value, 'label', c.label)
        order by c.sort_order, c.id
      )
      from public.contact_methods c
      where c.profile_id = p.id and c.is_public
    ), '[]'::jsonb),
    'socials', coalesce((
      select jsonb_agg(
        jsonb_build_object('platform', s.platform, 'url', s.url)
        order by s.sort_order, s.id
      )
      from public.social_links s
      where s.profile_id = p.id and s.is_public
    ), '[]'::jsonb),
    'updatedAt', p.updated_at
  )
  from public.profiles p
  where p.slug = lower(btrim(p_slug))
    and p.status = 'published';
$$;

revoke all on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;

-- Records an anonymous engagement event for a published profile. Owners viewing
-- their own card are not counted. A coarse per-profile burst guard keeps a
-- single client from inflating counts.
create or replace function public.record_profile_event(p_slug text, p_event_type text, p_source text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
  target_owner uuid;
  recent int;
begin
  select id, user_id into target_id, target_owner
  from public.profiles
  where slug = lower(btrim(p_slug)) and status = 'published';

  if target_id is null or target_owner = auth.uid() then
    return;
  end if;

  select count(*) into recent
  from public.profile_events
  where profile_id = target_id and created_at > now() - interval '10 seconds';

  if recent >= 30 then
    return;
  end if;

  insert into public.profile_events (profile_id, event_type, source)
  values (target_id, p_event_type, case when p_source in ('qr', 'link') then p_source end);
end;
$$;

revoke all on function public.record_profile_event(text, text, text) from public;
grant execute on function public.record_profile_event(text, text, text) to anon, authenticated;

-- Aggregate counts for the signed-in owner's profile (runs with caller rights,
-- so RLS limits it to their own events).
create or replace function public.get_my_profile_stats(p_days int default 30)
returns table (event_type text, source text, total bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.event_type, e.source, count(*)::bigint
  from public.profile_events e
  join public.profiles p on p.id = e.profile_id
  where p.user_id = auth.uid()
    and e.created_at > now() - make_interval(days => least(greatest(p_days, 1), 365))
  group by e.event_type, e.source;
$$;

revoke all on function public.get_my_profile_stats(int) from public;
grant execute on function public.get_my_profile_stats(int) to authenticated;

-- Atomically replace a profile's contact methods and social links. Runs with
-- caller rights, so RLS guarantees the caller owns the profile.
create or replace function public.replace_profile_children(
  p_profile_id uuid,
  p_contacts jsonb,
  p_socials jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles where id = p_profile_id and user_id = auth.uid()
  ) then
    raise exception 'Profile not found' using errcode = 'insufficient_privilege';
  end if;

  delete from public.contact_methods where profile_id = p_profile_id;
  delete from public.social_links where profile_id = p_profile_id;

  insert into public.contact_methods (profile_id, type, value, label, is_public, sort_order)
  select p_profile_id, (c ->> 'type')::public.contact_type, c ->> 'value', nullif(c ->> 'label', ''),
         coalesce((c ->> 'isPublic')::boolean, false), (ord - 1)::smallint
  from jsonb_array_elements(coalesce(p_contacts, '[]'::jsonb)) with ordinality as t(c, ord);

  insert into public.social_links (profile_id, platform, url, is_public, sort_order)
  select p_profile_id, s ->> 'platform', s ->> 'url',
         coalesce((s ->> 'isPublic')::boolean, true), (ord - 1)::smallint
  from jsonb_array_elements(coalesce(p_socials, '[]'::jsonb)) with ordinality as t(s, ord);
end;
$$;

revoke all on function public.replace_profile_children(uuid, jsonb, jsonb) from public;
grant execute on function public.replace_profile_children(uuid, jsonb, jsonb) to authenticated;

-- Slug availability without exposing whose slug it is.
create or replace function public.is_slug_available(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.profiles
    where slug = lower(btrim(p_slug))
      and user_id is distinct from auth.uid()
  );
$$;

revoke all on function public.is_slug_available(text) from public;
grant execute on function public.is_slug_available(text) to authenticated;

-- Lets a signed-in user permanently delete their own account. Profile,
-- contact methods, social links and events cascade. Avatar files are removed
-- by the app through the Storage API before this is called.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;

-- Retention: engagement events older than 13 months are deleted. Schedule with
-- pg_cron (see README), or run manually.
create or replace function public.purge_old_profile_events()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.profile_events where created_at < now() - interval '13 months';
$$;

revoke all on function public.purge_old_profile_events() from public;

-- ---------------------------------------------------------------------------
-- Storage: avatars
-- Public-read bucket; users may only write inside a folder named after their
-- own user id.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Users read their own avatar objects" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users upload avatars to their folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users update their avatars" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users delete their avatars" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
