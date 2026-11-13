-- Speaker card photos, kept in Meetwell's own storage: either copied from the
-- Google Drive links in a partner's spreadsheet (by the server, as the partner)
-- or uploaded straight from their computer. Public to read, like member photos.
-- Each event's photos live in a folder named after the event's link name, and
-- only that event's team (or an admin) can add or remove them.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('speaker-photos', 'speaker-photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- For the storage policies: may the caller manage the event with this link name?
create or replace function public.can_manage_event_folder(p_folder text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.manageable_event(p_folder) is not null;
$$;
revoke all on function public.can_manage_event_folder(text) from public, anon;
grant execute on function public.can_manage_event_folder(text) to authenticated;

drop policy if exists "Event teams upload speaker photos" on storage.objects;
create policy "Event teams upload speaker photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'speaker-photos' and public.can_manage_event_folder((storage.foldername(name))[1]));

drop policy if exists "Event teams delete speaker photos" on storage.objects;
create policy "Event teams delete speaker photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'speaker-photos' and public.can_manage_event_folder((storage.foldername(name))[1]));

-- Set a speaker card's photo to one in the event's own folder, or (null) clear
-- it, for a Google Drive photo that couldn't be copied (initials show instead).
create or replace function public.set_speaker_card_photo(p_event_slug text, p_slug text, p_url text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_event uuid := public.manageable_event(p_event_slug);
begin
  if v_event is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_url is not null and p_url !~ ('^https://[^/]+/storage/v1/object/public/speaker-photos/' || lower(p_event_slug) || '/[A-Za-z0-9._-]+$') then
    raise exception 'That photo is not in this event''s folder' using errcode = '22023';
  end if;
  update public.speaker_cards set photo_url = p_url where event_id = v_event and slug = lower(p_slug);
end;
$$;
revoke all on function public.set_speaker_card_photo(text, text, text) from public, anon;
grant execute on function public.set_speaker_card_photo(text, text, text) to authenticated;

-- The team's list now includes each card's photo (to show it, and to spot
-- Google Drive photos still to copy). Return type changes, so drop first.
drop function if exists public.event_speaker_cards_list(text);
create function public.event_speaker_cards_list(p_event_slug text)
returns table (slug text, full_name text, title text, organization text, email text, show_phone boolean, emailed_at timestamptz, photo_url text)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_event uuid := public.manageable_event(p_event_slug);
begin
  if v_event is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
    select c.slug, c.full_name, c.title, c.organization, c.email, c.show_phone, c.emailed_at, c.photo_url
    from public.speaker_cards c where c.event_id = v_event order by c.sort, c.created_at;
end;
$$;
revoke all on function public.event_speaker_cards_list(text) from public, anon;
grant execute on function public.event_speaker_cards_list(text) to authenticated;
