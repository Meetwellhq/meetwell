-- Minimal stand-ins for the Supabase platform objects the migration relies on,
-- so it can be exercised in an in-process Postgres (PGlite) during tests.

create role anon nologin;
create role authenticated nologin;

create schema auth;
create table auth.users (
  id uuid primary key, email text, raw_user_meta_data jsonb,
  created_at timestamptz default now(), email_confirmed_at timestamptz, last_sign_in_at timestamptz,
  deleted_at timestamptz
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

create schema storage;
create table storage.buckets (
  id text primary key, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select string_to_array(name, '/')
$$;
grant usage on schema storage to anon, authenticated;

grant usage on schema public to anon, authenticated;
-- Supabase grants table access to API roles by default; the migration must revoke what it doesn't want.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
