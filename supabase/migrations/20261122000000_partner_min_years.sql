-- Partner links are for experienced speakers: they only work as an invite (and
-- only count for the partner) when the person says they have 4+ years of
-- experience at sign-up. The years are kept on the account so onboarding can
-- fill them in. Same as 20261119000000_partners.sql otherwise.
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
  v_slug text;
begin
  if public.invite_only() then
    update public.access_codes
       set uses = uses + 1
     where code = public.normalize_access_code(v_meta ->> 'access_code')
       and uses < max_uses
       and (expires_at is null or expires_at > now());
    if not found then
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
