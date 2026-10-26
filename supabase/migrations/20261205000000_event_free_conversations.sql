-- Free mentors' conversations started from an event page are tagged with the
-- event, so admins and the partner's team can see how many conversations an
-- event brought in, not only paid ones. A conversation keeps the first event it
-- came from. Same rule as paid messages: only if the mentor speaks at that
-- active event of an active partner.

alter table public.conversations
  add column if not exists event_id uuid references public.partner_events (id) on delete set null;
create index if not exists conversations_event_idx on public.conversations (event_id) where event_id is not null;

-- One version with an optional event (the old one-argument call still works).
drop function if exists public.start_free_conversation(text);
create or replace function public.start_free_conversation(p_slug text, p_event text default null)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_mentor uuid;
  v_profile uuid;
  v_event uuid;
  v_conv bigint;
begin
  if v_user is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select p.user_id, p.id into v_mentor, v_profile
  from public.profiles p join public.mentor_settings m on m.user_id = p.user_id
  where p.slug = lower(p_slug) and p.status = 'published' and m.status = 'approved' and m.accepting and m.price_kobo = 0;
  if v_mentor is null then
    raise exception 'Not taking free messages' using errcode = '22023';
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
  insert into public.conversations (member_id, mentor_id, access_until, event_id)
  values (v_user, v_mentor, now() + interval '30 days', v_event)
  on conflict (member_id, mentor_id) do update
    set access_until = greatest(public.conversations.access_until, now() + interval '30 days'),
        event_id = coalesce(public.conversations.event_id, excluded.event_id)
  returning id into v_conv;
  return v_conv;
end;
$$;
revoke all on function public.start_free_conversation(text, text) from public;
revoke execute on function public.start_free_conversation(text, text) from anon;
grant execute on function public.start_free_conversation(text, text) to authenticated;

-- Admin: each event also shows how many free conversations it started.
drop function if exists public.admin_partner_events(text);
create function public.admin_partner_events(p_partner_slug text)
returns table (
  slug text, name text, starts_on date, ends_on date, venue text, about text, active boolean,
  speakers jsonb, payments integer, revenue_kobo integer, free_conversations integer
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
      (select coalesce(sum(y.amount_kobo), 0)::integer from public.payments y where y.event_id = e.id and y.status = 'success'),
      (select count(*)::integer from public.conversations c where c.event_id = e.id)
    from public.partner_events e
    join public.partners pa on pa.id = e.partner_id
    where pa.slug = lower(p_partner_slug)
    order by e.starts_on desc, e.created_at desc;
end;
$$;
revoke all on function public.admin_partner_events(text) from public;
revoke execute on function public.admin_partner_events(text) from anon;
grant execute on function public.admin_partner_events(text) to authenticated;

-- Partner teams: each event shows the conversations it started (free ones plus paid messages).
drop function if exists public.my_partner_events();
create function public.my_partner_events()
returns table (partner_name text, slug text, name text, starts_on date, active boolean, speakers integer, conversations integer)
language sql
stable
security definer
set search_path = ''
as $$
  select pa.name, e.slug, e.name, e.starts_on, e.active,
    (select count(*)::integer from public.event_speakers s where s.event_id = e.id),
    (select count(*)::integer from public.conversations c where c.event_id = e.id)
      + (select count(*)::integer from public.payments y where y.event_id = e.id and y.status = 'success')
  from public.partner_members pm
  join public.partners pa on pa.id = pm.partner_id
  join public.partner_events e on e.partner_id = pa.id
  where pm.user_id = auth.uid()
  order by e.starts_on desc;
$$;
revoke all on function public.my_partner_events() from public;
revoke execute on function public.my_partner_events() from anon;
grant execute on function public.my_partner_events() to authenticated;
