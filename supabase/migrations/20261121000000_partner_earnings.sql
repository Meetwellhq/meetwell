-- Partners step 2: their share of mentor payments. When a mentor who joined
-- through a partner is paid, the partner earns 10% of the payment, for 12
-- months from when that mentor joined. It comes out of Meetwell's 20%: the
-- mentor still gets 80%. Earnings count as available after 7 days (the
-- no-reply refund window), like mentors'. A refund takes the partner's share
-- back. Rasheed pays partners by hand and records each payout here.

create table if not exists public.partner_ledger (
  id bigint generated always as identity primary key,
  partner_id uuid not null references public.partners (id) on delete cascade,
  amount_kobo integer not null check (amount_kobo <> 0),
  kind text not null check (kind in ('earning', 'refund', 'payout')),
  payment_id bigint references public.payments (id) on delete set null,
  note text check (note is null or char_length(note) <= 200),
  available_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists partner_ledger_partner_idx on public.partner_ledger (partner_id, created_at desc);
create unique index if not exists partner_ledger_one_earning on public.partner_ledger (payment_id) where kind = 'earning';
create unique index if not exists partner_ledger_one_refund on public.partner_ledger (payment_id) where kind = 'refund';
alter table public.partner_ledger enable row level security;
revoke all on public.partner_ledger from anon, authenticated;

-- Records the partner's share when a subscription payment goes through, and
-- takes it back when it's refunded. Runs inside confirm_payment and
-- admin_mark_refunded, so every way a payment is confirmed or refunded is covered.
create or replace function public.partner_share_on_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_partner uuid;
  v_since timestamptz;
  v_share integer;
begin
  if new.kind <> 'subscription' or new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'success' then
    select s.partner_id, s.created_at into v_partner, v_since
    from public.partner_signups s where s.user_id = new.mentor_id;
    -- 10% of the payment, for the mentor's first 12 months on Meetwell.
    v_share := round(new.amount_kobo * 0.10);
    if v_partner is not null and coalesce(new.paid_at, now()) < v_since + interval '12 months' and v_share > 0 then
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

drop trigger if exists partner_share_on_payment on public.payments;
create trigger partner_share_on_payment
  after update of status on public.payments
  for each row execute function public.partner_share_on_payment();

-- A partner's totals: everything earned (after refunds), paid out, ready to pay
-- (earned more than 7 days ago, minus payouts) and still in the 7-day window.
create or replace function public.partner_totals(p_partner uuid)
returns table (earned_kobo integer, paid_kobo integer, available_kobo integer, pending_kobo integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(sum(l.amount_kobo) filter (where l.kind <> 'payout'), 0)::integer,
    coalesce(-sum(l.amount_kobo) filter (where l.kind = 'payout'), 0)::integer,
    coalesce(sum(l.amount_kobo) filter (where l.available_at <= now()), 0)::integer,
    coalesce(sum(l.amount_kobo) filter (where l.kind = 'earning' and l.available_at > now()), 0)::integer
  from public.partner_ledger l
  where l.partner_id = p_partner;
$$;
revoke all on function public.partner_totals(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------

create or replace function public.admin_partner_money(p_partner uuid)
returns table (earned_kobo integer, paid_kobo integer, available_kobo integer, pending_kobo integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query select * from public.partner_totals(p_partner);
end;
$$;
revoke all on function public.admin_partner_money(uuid) from public;
revoke execute on function public.admin_partner_money(uuid) from anon;
grant execute on function public.admin_partner_money(uuid) to authenticated;

-- Every earning, refund and payout for one partner, newest first.
create or replace function public.admin_partner_ledger(p_partner uuid)
returns table (created_at timestamptz, kind text, amount_kobo integer, mentor_name text, note text, available_at timestamptz)
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
    select l.created_at, l.kind, l.amount_kobo, pr.full_name, l.note, l.available_at
    from public.partner_ledger l
    left join public.payments pa on pa.id = l.payment_id
    left join public.profiles pr on pr.user_id = pa.mentor_id
    where l.partner_id = p_partner
    order by l.created_at desc
    limit 300;
end;
$$;
revoke all on function public.admin_partner_ledger(uuid) from public;
revoke execute on function public.admin_partner_ledger(uuid) from anon;
grant execute on function public.admin_partner_ledger(uuid) to authenticated;

-- After paying a partner (by bank transfer), record it. Only up to what's ready to pay.
create or replace function public.admin_record_partner_payout(p_partner uuid, p_amount_kobo integer, p_note text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_available integer;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  perform 1 from public.partners where id = p_partner for update;
  select t.available_kobo into v_available from public.partner_totals(p_partner) t;
  if p_amount_kobo is null or p_amount_kobo <= 0 or p_amount_kobo > coalesce(v_available, 0) then
    raise exception 'More than is ready to pay' using errcode = '22023';
  end if;
  insert into public.partner_ledger (partner_id, amount_kobo, kind, note)
  values (p_partner, -p_amount_kobo, 'payout', nullif(left(btrim(coalesce(p_note, '')), 200), ''));
end;
$$;
revoke all on function public.admin_record_partner_payout(uuid, integer, text) from public;
revoke execute on function public.admin_record_partner_payout(uuid, integer, text) from anon;
grant execute on function public.admin_record_partner_payout(uuid, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- The partner's own page: totals only, never per-person earnings
-- ---------------------------------------------------------------------------

create or replace function public.my_partner_money(p_partner uuid)
returns table (earned_kobo integer, paid_kobo integer, available_kobo integer, pending_kobo integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.partner_members pm where pm.partner_id = p_partner and pm.user_id = auth.uid()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query select * from public.partner_totals(p_partner);
end;
$$;
revoke all on function public.my_partner_money(uuid) from public;
revoke execute on function public.my_partner_money(uuid) from anon;
grant execute on function public.my_partner_money(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin overview: Meetwell's share now also leaves out the partner's 10%
-- ---------------------------------------------------------------------------
create or replace function public.admin_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_month timestamptz := public.spark_month_start();
  v_last_month timestamptz := (date_trunc('month', (now() at time zone 'Africa/Lagos') - interval '1 month')) at time zone 'Africa/Lagos';
  v_week timestamptz := (date_trunc('week', now() at time zone 'Africa/Lagos')) at time zone 'Africa/Lagos';
  v_out jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  with members as (
    select u.id, u.created_at, u.email_confirmed_at, u.last_sign_in_at
    from auth.users u
    where not public.is_admin_user(u.id)
  ),
  paid as (
    -- Meetwell's share: all of a credits payment, 20% of a subscription, less a partner's 10% if any.
    select p.user_id,
      p.amount_kobo - coalesce(p.mentor_share_kobo, 0)
        - coalesce((select sum(l.amount_kobo) from public.partner_ledger l where l.payment_id = p.id and l.kind = 'earning'), 0)
        as amount_kobo,
      coalesce(p.credits, 0) as credits, p.paid_at
    from public.payments p
    where p.status = 'success'
  )
  select jsonb_build_object(
    'members', (select count(*) from members),
    'members_this_month', (select count(*) from members where created_at >= v_month),
    'members_last_month', (select count(*) from members where created_at >= v_last_month and created_at < v_month),
    'confirmed', (select count(*) from members where email_confirmed_at is not null),
    'active_30d', (select count(*) from members where last_sign_in_at > now() - interval '30 days'),
    'active_7d', (select count(*) from members where last_sign_in_at > now() - interval '7 days'),
    'cards_published', (select count(*) from public.profiles p where p.status = 'published'),
    'waitlist', (select count(*) from public.waitlist),
    'waitlist_waiting', (select count(*) from public.waitlist w where w.invited_at is null),
    'waitlist_this_month', (select count(*) from public.waitlist w where w.created_at >= v_month),
    'spark_on', (select count(*) from public.profiles p where p.matching_opt_in),
    'mentors', (select count(*) from public.profiles p where p.matching_opt_in and p.experience_years >= 4),
    'seekers', (select count(*) from public.profiles p where p.matching_opt_in and p.experience_years < 4),
    'matches_this_month', (select count(*) from public.matches m where m.created_at >= v_month),
    'qr_scans_30d', (select count(*) from public.profile_events e
                     where e.event_type = 'view' and e.source = 'qr' and e.created_at > now() - interval '30 days'),
    'saves_30d', (select count(*) from public.profile_events e
                  where e.event_type = 'save_contact' and e.created_at > now() - interval '30 days'),
    'revenue_total_kobo', (select coalesce(sum(amount_kobo), 0) from paid),
    'revenue_this_month_kobo', (select coalesce(sum(amount_kobo), 0) from paid where paid_at >= v_month),
    'revenue_last_month_kobo', (select coalesce(sum(amount_kobo), 0) from paid where paid_at >= v_last_month and paid_at < v_month),
    'revenue_30d_kobo', (select coalesce(sum(amount_kobo), 0) from paid where paid_at > now() - interval '30 days'),
    'paying_members', (select count(distinct user_id) from paid),
    'paying_30d', (select count(distinct user_id) from paid where paid_at > now() - interval '30 days'),
    'credits_sold', (select coalesce(sum(credits), 0) from paid),
    'credits_used', (select coalesce(-sum(l.delta), 0) from public.credit_ledger l where l.reason = 'match'),
    'signups_by_week', (
      select jsonb_agg(jsonb_build_object('start', w.start, 'count', (
        select count(*) from members m where m.created_at >= w.start and m.created_at < w.start + interval '7 days'
      )) order by w.start)
      from (select v_week - make_interval(weeks => g) as start from generate_series(0, 11) g) w
    ),
    'revenue_by_month', (
      select jsonb_agg(jsonb_build_object('start', mo.start, 'kobo', (
        select coalesce(sum(amount_kobo), 0) from paid
        where paid_at >= mo.start
          and paid_at < ((date_trunc('month', mo.start at time zone 'Africa/Lagos') + interval '1 month') at time zone 'Africa/Lagos')
      )) order by mo.start)
      from (
        select (date_trunc('month', (now() at time zone 'Africa/Lagos') - make_interval(months => g))) at time zone 'Africa/Lagos' as start
        from generate_series(0, 5) g
      ) mo
    )
  ) into v_out;
  return v_out;
end;
$$;
revoke all on function public.admin_metrics() from public;
revoke execute on function public.admin_metrics() from anon;
grant execute on function public.admin_metrics() to authenticated;
