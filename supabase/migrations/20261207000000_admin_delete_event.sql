-- Admins can delete an event, but only while nothing has come from it yet: no
-- payments (any status) and no conversations started from its page. Once it has
-- history, hide it instead, so its numbers and the partner's earnings stay
-- explained. Its speaker list goes with it.
create or replace function public.admin_delete_event(p_event_slug text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_event uuid;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select id into v_event from public.partner_events where slug = lower(p_event_slug);
  if v_event is null then
    raise exception 'No such event' using errcode = '22023';
  end if;
  if exists (select 1 from public.payments where event_id = v_event)
     or exists (select 1 from public.conversations where event_id = v_event) then
    raise exception 'Event has history' using errcode = '23503';
  end if;
  delete from public.partner_events where id = v_event;
end;
$$;
revoke all on function public.admin_delete_event(text) from public;
revoke execute on function public.admin_delete_event(text) from anon;
grant execute on function public.admin_delete_event(text) to authenticated;
