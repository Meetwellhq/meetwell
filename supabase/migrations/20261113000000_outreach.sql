-- Outreach tracker: people the founder finds on X and contacts by hand.
--
-- Admin only. Each person gets a personal single-use access code, so sign-ups
-- from outreach can be counted. Nothing here sends messages: the founder
-- writes each DM or reply himself on X.

create table if not exists public.outreach_contacts (
  id bigint generated always as identity primary key,
  first_name text not null check (char_length(btrim(first_name)) between 1 and 40),
  x_handle text not null unique check (x_handle ~ '^[a-z0-9_]{1,15}$'),
  note text check (note is null or char_length(note) <= 300),
  access_code text references public.access_codes (code) on delete set null,
  status text not null default 'to_contact' check (status in ('to_contact', 'contacted', 'replied', 'declined')),
  contacted_at timestamptz,
  replied_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.outreach_contacts enable row level security;
revoke all on public.outreach_contacts from anon, authenticated;

-- Everyone on the list, newest first, with whether their code was used.
create or replace function public.admin_list_outreach()
returns table (
  id bigint,
  first_name text,
  x_handle text,
  note text,
  access_code text,
  status text,
  contacted_at timestamptz,
  replied_at timestamptz,
  created_at timestamptz,
  joined boolean
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
    select o.id, o.first_name, o.x_handle, o.note, o.access_code, o.status,
           o.contacted_at, o.replied_at, o.created_at, coalesce(c.uses > 0, false)
    from public.outreach_contacts o
    left join public.access_codes c on c.code = o.access_code
    order by o.created_at desc, o.id desc;
end;
$$;

-- Add someone, with a personal single-use code valid for 60 days. Returns the code.
create or replace function public.admin_add_outreach(p_first_name text, p_handle text, p_note text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_handle text := lower(btrim(coalesce(p_handle, ''), ' @'));
  v_code text;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if exists (select 1 from public.outreach_contacts where x_handle = v_handle) then
    raise exception 'That person is already on the list' using errcode = '23505';
  end if;

  v_code := 'MW-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  v_code := substr(v_code, 1, 7) || '-' || substr(v_code, 8, 4) || '-' || substr(v_code, 12, 4);
  insert into public.access_codes (code, max_uses, note, expires_at)
  values (v_code, 1, 'Outreach @' || v_handle, now() + interval '60 days');

  insert into public.outreach_contacts (first_name, x_handle, note, access_code)
  values (btrim(p_first_name), v_handle, nullif(btrim(coalesce(p_note, '')), ''), v_code);
  return v_code;
end;
$$;

-- Move someone along: contacted, replied, declined (or back to the start).
create or replace function public.admin_set_outreach_status(p_id bigint, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.outreach_contacts
     set status = p_status,
         contacted_at = case when p_status = 'to_contact' then null else coalesce(contacted_at, now()) end,
         replied_at = case when p_status = 'replied' then coalesce(replied_at, now()) when p_status = 'to_contact' then null else replied_at end
   where id = p_id;
  if not found then
    raise exception 'Not found' using errcode = 'P0002';
  end if;
end;
$$;

-- Remove someone, and their code if it was never used.
create or replace function public.admin_delete_outreach(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  delete from public.outreach_contacts where id = p_id returning access_code into v_code;
  delete from public.access_codes where code = v_code and uses = 0;
end;
$$;

revoke all on function public.admin_list_outreach() from public, anon;
revoke all on function public.admin_add_outreach(text, text, text) from public, anon;
revoke all on function public.admin_set_outreach_status(bigint, text) from public, anon;
revoke all on function public.admin_delete_outreach(bigint) from public, anon;
grant execute on function public.admin_list_outreach() to authenticated;
grant execute on function public.admin_add_outreach(text, text, text) to authenticated;
grant execute on function public.admin_set_outreach_status(bigint, text) to authenticated;
grant execute on function public.admin_delete_outreach(bigint) to authenticated;
