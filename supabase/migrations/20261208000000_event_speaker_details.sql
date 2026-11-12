-- Adding a speaker also returns what the "you're a speaker" email needs: their
-- name, email and card, whether they were newly added (so nobody is emailed
-- twice), and the event's details. The old admin_add_event_speaker stays for
-- the app version still running while this SQL goes live.
create or replace function public.admin_add_event_speaker_details(p_event_slug text, p_who text)
returns table (
  full_name text, email text, profile_slug text, card_status text, added boolean,
  event_name text, starts_on date, ends_on date, venue text, partner_name text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_event uuid;
  v_profile uuid;
  v_who text := lower(btrim(regexp_replace(coalesce(p_who, ''), '^.*/p/', '')));
  v_added boolean;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select id into v_event from public.partner_events where slug = lower(p_event_slug);
  if v_event is null then
    raise exception 'No such event' using errcode = '22023';
  end if;
  select p.id into v_profile
  from public.profiles p left join auth.users u on u.id = p.user_id
  where p.slug = v_who or lower(u.email) = v_who
  limit 1;
  if v_profile is null then
    raise exception 'No card found for that email or link' using errcode = '22023';
  end if;
  insert into public.event_speakers (event_id, profile_id, sort)
  values (v_event, v_profile, (select coalesce(max(sort), 0) + 1 from public.event_speakers where event_id = v_event))
  on conflict do nothing;
  v_added := found;
  return query
    select p.full_name, u.email::text, p.slug, p.status::text, v_added,
           e.name, e.starts_on, e.ends_on, e.venue, pa.name
    from public.profiles p
    join auth.users u on u.id = p.user_id
    join public.partner_events e on e.id = v_event
    join public.partners pa on pa.id = e.partner_id
    where p.id = v_profile;
end;
$$;
revoke all on function public.admin_add_event_speaker_details(text, text) from public;
revoke execute on function public.admin_add_event_speaker_details(text, text) from anon;
grant execute on function public.admin_add_event_speaker_details(text, text) to authenticated;
