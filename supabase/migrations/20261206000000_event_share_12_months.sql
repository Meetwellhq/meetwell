-- An event's partner earns its 10% for 12 months after the event (from its last
-- day, Lagos time), not forever (Rasheed, 26 Oct 2026). After that a payment
-- from the event page follows the normal rule: the partner the mentor joined
-- through, within 12 months of the mentor's sign-up. The payment stays tagged
-- with the event, so the event's totals are unchanged.
create or replace function public.partner_share_on_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_partner uuid;
  v_since timestamptz;
  v_until timestamptz;
  v_share integer;
begin
  if new.kind <> 'subscription' or new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'success' then
    v_share := round(new.amount_kobo * 0.10);
    if new.event_id is not null then
      select e.partner_id,
             ((coalesce(e.ends_on, e.starts_on) + interval '1 day' + interval '12 months')::timestamp at time zone 'Africa/Lagos')
        into v_partner, v_until
      from public.partner_events e where e.id = new.event_id;
      if v_partner is not null and coalesce(new.paid_at, now()) >= v_until then
        v_partner := null;
      end if;
    end if;
    if v_partner is null then
      select s.partner_id, s.created_at into v_partner, v_since
      from public.partner_signups s where s.user_id = new.mentor_id;
      if v_partner is not null and coalesce(new.paid_at, now()) >= v_since + interval '12 months' then
        v_partner := null;
      end if;
    end if;
    if v_partner is not null and v_share > 0 then
      insert into public.partner_ledger (partner_id, amount_kobo, kind, payment_id, available_at)
      values (v_partner, v_share, 'earning', new.id, now() + interval '7 days')
      on conflict do nothing;
    end if;
  elsif new.status = 'refunded' then
    insert into public.partner_ledger (partner_id, amount_kobo, kind, payment_id)
    select l.partner_id, -l.amount_kobo, 'refund', new.id
    from public.partner_ledger l where l.payment_id = new.id and l.kind = 'earning'
    on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.partner_share_on_payment() from public, anon, authenticated;
