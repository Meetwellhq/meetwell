-- Admins can edit an event after creating it: name, dates, venue and the short
-- description. The link name (slug) stays fixed, because event and badge QR
-- codes may already be printed with it.
create or replace function public.admin_update_event(
  p_event_slug text, p_name text, p_starts_on date,
  p_ends_on date default null, p_venue text default null, p_about text default null
)
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
  update public.partner_events
     set name = btrim(p_name),
         starts_on = p_starts_on,
         ends_on = p_ends_on,
         venue = nullif(btrim(coalesce(p_venue, '')), ''),
         about = nullif(btrim(coalesce(p_about, '')), '')
   where slug = lower(p_event_slug);
  if not found then
    raise exception 'No such event' using errcode = '22023';
  end if;
end;
$$;
revoke all on function public.admin_update_event(text, text, date, date, text, text) from public;
revoke execute on function public.admin_update_event(text, text, date, date, text, text) from anon;
grant execute on function public.admin_update_event(text, text, date, date, text, text) to authenticated;
