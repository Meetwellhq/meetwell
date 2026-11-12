-- Partner radar: what's already on the radar, for the weekly search (cron
-- secret), so it doesn't add an event again under a slightly different name.
-- Only names, dates and ids: no notes, contacts or stages.

create or replace function public.radar_known_events(p_token text)
returns table (id text, name text, start_date date, end_date date)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.radar_check_token(p_token);
  return query
    select r.id, r.name, r.start_date, r.end_date
    from public.radar_events r
    where coalesce(r.end_date, r.start_date) >= (now() at time zone 'Africa/Lagos')::date - 30
    order by r.start_date, r.name;
end;
$$;

revoke all on function public.radar_known_events(text) from public, authenticated;
grant execute on function public.radar_known_events(text) to anon;
