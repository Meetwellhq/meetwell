-- Automatic one-time reminders, sent by a daily job (Vercel Cron → /api/cron/reminders).
--
--   invite_unused      invited 3+ days ago, code still unused and valid
--   email_unconfirmed  account 1–14 days old, email never confirmed
--   card_draft         confirmed 2+ days ago, card not published (or not started)
--   no_scans           card published 7+ days ago, never opened from a QR scan
--
-- Each person gets each reminder at most once (reminders_sent).
--
-- The job proves itself with a shared secret. Store the same value as the
-- CRON_SECRET environment variable in Vercel:
--   insert into public.internal_settings (key, value) values ('cron_secret', '<secret>')
--   on conflict (key) do update set value = excluded.value;

create table if not exists public.internal_settings (
  key text primary key,
  value text not null
);
alter table public.internal_settings enable row level security;
revoke all on public.internal_settings from anon, authenticated;

create table if not exists public.reminders_sent (
  kind text not null check (kind in ('invite_unused', 'email_unconfirmed', 'card_draft', 'no_scans')),
  email text not null,
  sent_at timestamptz not null default now(),
  primary key (kind, email)
);
alter table public.reminders_sent enable row level security;
revoke all on public.reminders_sent from anon, authenticated;

-- Returns the reminders that are due and records them as sent, in one step,
-- so overlapping runs can't send the same reminder twice.
create or replace function public.claim_reminders(p_token text, p_limit integer default 40)
returns table (kind text, email text, full_name text, access_code text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_secret text;
begin
  select s.value into v_secret from public.internal_settings s where s.key = 'cron_secret';
  if v_secret is null or char_length(v_secret) < 32 or p_token is distinct from v_secret then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return query
  with candidates as (
    select 'invite_unused'::text as kind, w.email, w.full_name, w.access_code
    from public.waitlist w
    join public.access_codes c on c.code = w.access_code
    where w.invited_at < now() - interval '3 days'
      and c.uses < c.max_uses
      and (c.expires_at is null or c.expires_at > now())

    union all
    select 'email_unconfirmed', u.email::text, null::text, null::text
    from auth.users u
    where u.email_confirmed_at is null
      and u.created_at < now() - interval '1 day'
      and u.created_at > now() - interval '14 days'

    union all
    select 'card_draft', u.email::text, p.full_name, null::text
    from auth.users u
    left join public.profiles p on p.user_id = u.id
    where u.email_confirmed_at is not null
      and u.created_at < now() - interval '2 days'
      and (p.id is null or p.status = 'draft')

    union all
    select 'no_scans', u.email::text, p.full_name, null::text
    from auth.users u
    join public.profiles p on p.user_id = u.id
    where p.status = 'published'
      and p.published_at < now() - interval '7 days'
      and not exists (
        select 1 from public.profile_events e
        where e.profile_id = p.id and e.event_type = 'view' and e.source = 'qr'
      )
  ),
  due as (
    select c.* from candidates c
    where c.email is not null
      and not exists (select 1 from public.reminders_sent r where r.kind = c.kind and r.email = c.email)
    limit greatest(least(coalesce(p_limit, 40), 200), 0)
  ),
  claimed as (
    insert into public.reminders_sent (kind, email)
    select d.kind, d.email from due d
    on conflict do nothing
    returning reminders_sent.kind, reminders_sent.email
  )
  select d.kind, d.email, d.full_name, d.access_code
  from due d
  join claimed cl on cl.kind = d.kind and cl.email = d.email;
end;
$$;

revoke all on function public.claim_reminders(text, integer) from public;
-- The job calls without a user session; the secret is what protects it.
grant execute on function public.claim_reminders(text, integer) to anon;
