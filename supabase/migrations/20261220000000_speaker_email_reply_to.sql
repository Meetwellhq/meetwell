-- Speaker emails now come from the event organiser ("Tech Hub via Meetwell"),
-- with replies going to the team member who invited or added the speakers.
-- The claim functions also return that person's email (reply_to). Return types
-- change, so each is dropped and made again; logic and grants are unchanged.

drop function if exists public.claim_speaker_invite_emails(text, text, integer);
create function public.claim_speaker_invite_emails(p_token text, p_event_slug text, p_limit integer)
returns table (
  email text, full_name text, code text,
  event_name text, event_slug text, starts_on date, ends_on date, venue text, partner_name text, reply_to text
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
    select i.id
    from public.event_speaker_invites i
    join public.partner_events e on e.id = i.event_id
    where i.emailed_at is null and i.user_id is null
      and (p_event_slug is null or e.slug = lower(p_event_slug))
      and coalesce(e.ends_on, e.starts_on) >= (now() at time zone 'Africa/Lagos')::date
    order by i.created_at
    limit least(greatest(coalesce(p_limit, 40), 1), 100)
    for update of i skip locked
  ), marked as (
    update public.event_speaker_invites i set emailed_at = now()
    from due where i.id = due.id
    returning i.*
  )
  select m.email, m.full_name, m.code, e.name, e.slug, e.starts_on, e.ends_on, e.venue, pa.name, u.email::text
  from marked m
  join public.partner_events e on e.id = m.event_id
  join public.partners pa on pa.id = e.partner_id
  left join auth.users u on u.id = m.invited_by;
end;
$$;
revoke all on function public.claim_speaker_invite_emails(text, text, integer) from public;
grant execute on function public.claim_speaker_invite_emails(text, text, integer) to anon, authenticated;

drop function if exists public.claim_speaker_invite_reminders(text, integer);
create function public.claim_speaker_invite_reminders(p_token text, p_limit integer)
returns table (
  email text, full_name text, code text,
  event_name text, event_slug text, starts_on date, ends_on date, venue text, partner_name text, reply_to text
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
    select i.id
    from public.event_speaker_invites i
    join public.partner_events e on e.id = i.event_id
    where i.emailed_at <= now() - interval '3 days'
      and i.reminded_at is null and i.user_id is null
      and e.starts_on >= (now() at time zone 'Africa/Lagos')::date
    order by i.emailed_at
    limit least(greatest(coalesce(p_limit, 40), 1), 100)
    for update of i skip locked
  ), marked as (
    update public.event_speaker_invites i set reminded_at = now()
    from due where i.id = due.id
    returning i.*
  )
  select m.email, m.full_name, m.code, e.name, e.slug, e.starts_on, e.ends_on, e.venue, pa.name, u.email::text
  from marked m
  join public.partner_events e on e.id = m.event_id
  join public.partners pa on pa.id = e.partner_id
  left join auth.users u on u.id = m.invited_by;
end;
$$;
revoke all on function public.claim_speaker_invite_reminders(text, integer) from public;
grant execute on function public.claim_speaker_invite_reminders(text, integer) to anon, authenticated;

drop function if exists public.claim_speaker_card_emails(text, text, integer);
create function public.claim_speaker_card_emails(p_token text, p_event_slug text, p_limit integer)
returns table (
  email text, full_name text, slug text, code text, remove_token uuid, show_phone boolean,
  event_name text, event_slug text, starts_on date, ends_on date, venue text, partner_name text, reply_to text
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
    e.name, e.slug, e.starts_on, e.ends_on, e.venue, pa.name, u.email::text
  from marked m
  join public.partner_events e on e.id = m.event_id
  join public.partners pa on pa.id = e.partner_id
  left join auth.users u on u.id = m.consent_by;
end;
$$;
revoke all on function public.claim_speaker_card_emails(text, text, integer) from public;
grant execute on function public.claim_speaker_card_emails(text, text, integer) to anon, authenticated;
