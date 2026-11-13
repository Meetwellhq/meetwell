-- Delete a partner for good: its invite link, team access, the record of who
-- joined through it, its event pages, speaker cards and speaker invites.
-- People who joined keep their accounts and cards.
-- Refused once money or conversations have come through the partner (any row in
-- partner_ledger, or a payment or conversation started from one of its event
-- pages): those records must stay, so pause the link instead.

create or replace function public.admin_delete_partner(p_partner uuid)
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
  if not exists (select 1 from public.partners where id = p_partner) then
    raise exception 'No such partner' using errcode = '22023';
  end if;
  if exists (select 1 from public.partner_ledger where partner_id = p_partner)
     or exists (select 1 from public.payments y join public.partner_events e on e.id = y.event_id where e.partner_id = p_partner)
     or exists (select 1 from public.conversations c join public.partner_events e on e.id = c.event_id where e.partner_id = p_partner) then
    raise exception 'Partner has history' using errcode = '23503';
  end if;
  delete from public.partners where id = p_partner;
end;
$$;
revoke all on function public.admin_delete_partner(uuid) from public;
revoke execute on function public.admin_delete_partner(uuid) from anon;
grant execute on function public.admin_delete_partner(uuid) to authenticated;
