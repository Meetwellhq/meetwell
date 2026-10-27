-- Shared access codes for events (first: DevFest Abeokuta). One code, many
-- sign-ups, up to a limit and until an end date, for anyone (no experience
-- rule, unlike partner links). Every account made with a shared code is kept in
-- code_signups, so admins can see who joined through it and follow up.

alter table public.access_codes add column if not exists shared boolean not null default false;

create table if not exists public.code_signups (
  -- Deferred so the sign-up trigger can add the row for an account being created.
  user_id uuid primary key references auth.users (id) on delete cascade deferrable initially deferred,
  code text not null references public.access_codes (code) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists code_signups_code_idx on public.code_signups (code, created_at desc);
alter table public.code_signups enable row level security;
revoke all on public.code_signups from anon, authenticated;

-- Same as 20261122000000_partner_min_years.sql, plus: a shared code records who used it.
create or replace function public.enforce_access_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_via uuid;
  -- A partner link only counts for people with 4+ years (mentors), as they said at sign-up.
  v_years integer := case when v_meta ->> 'experience_years' ~ '^[0-9]{1,2}$' then (v_meta ->> 'experience_years')::integer end;
  v_partner uuid := case when coalesce(v_years, 0) >= 4 then public.partner_invite_id(v_meta ->> 'via_partner') end;
  v_code text := public.normalize_access_code(v_meta ->> 'access_code');
  v_shared boolean;
  v_slug text;
begin
  if public.invite_only() then
    update public.access_codes
       set uses = uses + 1
     where code = v_code
       and uses < max_uses
       and (expires_at is null or expires_at > now())
    returning shared into v_shared;
    if found then
      if v_shared then
        insert into public.code_signups (user_id, code) values (new.id, v_code) on conflict do nothing;
      end if;
    else
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

  -- Don't keep any of this on the user record (experience_years stays, to fill in onboarding).
  new.raw_user_meta_data := v_meta - 'access_code' - 'via_card' - 'saved_cards' - 'via_partner';
  return new;
end;
$$;
revoke all on function public.enforce_access_code() from public, anon, authenticated;

-- New shared code. It works until the end of p_ends_on (Lagos time). Returns the code as stored.
create or replace function public.admin_create_shared_code(p_code text, p_note text, p_max_uses integer, p_ends_on date)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_code text := public.normalize_access_code(p_code);
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if v_code !~ '^[A-Z0-9-]{6,32}$' then
    raise exception 'Use 6 to 32 letters, numbers or dashes' using errcode = '22023';
  end if;
  if p_max_uses is null or p_max_uses not between 1 and 100000 then
    raise exception 'Pick how many people can use it' using errcode = '22023';
  end if;
  if p_ends_on is null or p_ends_on < (now() at time zone 'Africa/Lagos')::date then
    raise exception 'Pick an end date that has not passed' using errcode = '22023';
  end if;
  insert into public.access_codes (code, max_uses, note, expires_at, shared)
  values (v_code, p_max_uses, nullif(btrim(coalesce(p_note, '')), ''),
          ((p_ends_on + 1)::timestamp at time zone 'Africa/Lagos'), true);
  return v_code;
end;
$$;
revoke all on function public.admin_create_shared_code(text, text, integer, date) from public;
revoke execute on function public.admin_create_shared_code(text, text, integer, date) from anon;
grant execute on function public.admin_create_shared_code(text, text, integer, date) to authenticated;

-- Stop a shared code now (people who already joined keep their accounts).
create or replace function public.admin_stop_shared_code(p_code text)
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
  update public.access_codes set expires_at = now()
  where code = public.normalize_access_code(p_code) and shared and (expires_at is null or expires_at > now());
end;
$$;
revoke all on function public.admin_stop_shared_code(text) from public;
revoke execute on function public.admin_stop_shared_code(text) from anon;
grant execute on function public.admin_stop_shared_code(text) to authenticated;

-- Every shared code with how far it has gone: sign-ups, and how many published a card.
create or replace function public.admin_shared_codes()
returns table (
  code text, note text, max_uses integer, uses integer, expires_at timestamptz, created_at timestamptz,
  active boolean, joined integer, published integer
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
    select c.code, c.note, c.max_uses, c.uses, c.expires_at, c.created_at,
      (c.uses < c.max_uses and (c.expires_at is null or c.expires_at > now())),
      (select count(*)::integer from public.code_signups s where s.code = c.code),
      (select count(*)::integer from public.code_signups s
         join public.profiles p on p.user_id = s.user_id and p.status = 'published'
        where s.code = c.code)
    from public.access_codes c
    where c.shared
    order by c.created_at desc;
end;
$$;
revoke all on function public.admin_shared_codes() from public;
revoke execute on function public.admin_shared_codes() from anon;
grant execute on function public.admin_shared_codes() to authenticated;
