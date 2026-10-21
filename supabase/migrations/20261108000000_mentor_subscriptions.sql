-- Phase 4: mentors, paid 30-day subscriptions to message them, and the mentor wallet.
--
-- Mentors (4+ years) apply; an admin approves. Approved mentors set a monthly
-- price between N2,000 and N20,000. A member (under 4 years) pays for 30 days
-- of messages; Meetwell keeps 20% and 80% goes into the mentor's wallet. Each
-- earning becomes withdrawable 7 days after the payment (the no-reply refund
-- window). Mentors withdraw N5,000 or more to a bank account checked by
-- Paystack; an admin approves each withdrawal and it's sent by Paystack Transfer.
-- Prices, shares and balances are computed here, never in the browser.

-- ---------------------------------------------------------------------------
-- Payments can now be credits or a subscription
-- ---------------------------------------------------------------------------

alter table public.payments add column if not exists kind text not null default 'credits';
alter table public.payments add column if not exists mentor_id uuid references auth.users (id) on delete set null;
alter table public.payments add column if not exists days integer;
alter table public.payments add column if not exists mentor_share_kobo integer;
alter table public.payments alter column pack_id drop not null;
alter table public.payments alter column credits drop not null;
alter table public.payments drop constraint if exists payments_kind_check;
alter table public.payments add constraint payments_kind_check check (
  (kind = 'credits' and pack_id is not null and credits is not null)
  or (kind = 'subscription' and mentor_id is not null and days > 0 and mentor_share_kobo >= 0)
);
alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check
  check (status in ('pending', 'success', 'failed', 'refunded'));
create index if not exists payments_mentor_idx on public.payments (mentor_id, paid_at desc);

-- ---------------------------------------------------------------------------
-- Mentors
-- ---------------------------------------------------------------------------

create table if not exists public.mentor_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null default 'applied' check (status in ('applied', 'approved', 'rejected', 'paused')),
  price_kobo integer not null default 500000 check (price_kobo between 200000 and 2000000),
  accepting boolean not null default true,
  applied_at timestamptz not null default now(),
  decided_at timestamptz
);
alter table public.mentor_settings enable row level security;
revoke all on public.mentor_settings from anon, authenticated;

-- Where a mentor's withdrawals go. We keep only what's needed to show and pay:
-- Paystack holds the full account number behind recipient_code.
create table if not exists public.payout_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  bank_code text not null,
  bank_name text not null,
  account_last4 text not null check (account_last4 ~ '^[0-9]{4}$'),
  account_name text not null,
  recipient_code text not null,
  verified_at timestamptz not null default now()
);
alter table public.payout_accounts enable row level security;
revoke all on public.payout_accounts from anon, authenticated;

create table if not exists public.withdrawals (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount_kobo integer not null check (amount_kobo >= 500000),
  status text not null default 'requested'
    check (status in ('requested', 'processing', 'paid', 'failed', 'rejected')),
  reference text not null unique,
  bank_name text not null,
  account_last4 text not null,
  account_name text not null,
  recipient_code text not null,
  transfer_code text,
  note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  paid_at timestamptz
);
create index if not exists withdrawals_user_idx on public.withdrawals (user_id, created_at desc);
alter table public.withdrawals enable row level security;
revoke all on public.withdrawals from anon, authenticated;

-- Every naira in or out of a wallet is one row. Earnings count as available
-- from available_at; withdrawals and refunds count at once.
create table if not exists public.wallet_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount_kobo integer not null check (amount_kobo <> 0),
  kind text not null check (kind in ('earning', 'withdrawal', 'withdrawal_reversal', 'refund', 'adjustment')),
  payment_id bigint references public.payments (id) on delete set null,
  withdrawal_id bigint references public.withdrawals (id) on delete set null,
  available_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists wallet_ledger_user_idx on public.wallet_ledger (user_id);
create unique index if not exists wallet_ledger_one_earning on public.wallet_ledger (payment_id) where kind = 'earning';
create unique index if not exists wallet_ledger_one_refund on public.wallet_ledger (payment_id) where kind = 'refund';
alter table public.wallet_ledger enable row level security;
revoke all on public.wallet_ledger from anon, authenticated;

create table if not exists public.subscription_reminders_sent (
  conversation_id bigint not null references public.conversations (id) on delete cascade,
  access_until timestamptz not null,
  sent_at timestamptz not null default now(),
  primary key (conversation_id, access_until)
);
alter table public.subscription_reminders_sent enable row level security;
revoke all on public.subscription_reminders_sent from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers (internal)
-- ---------------------------------------------------------------------------

-- Which mentor requirements a member meets, as {"years": true, ...}.
create or replace function public.mentor_checks(p_user uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'years', coalesce(p.experience_years >= 4, false),
    'photo', p.avatar_url is not null,
    'complete', coalesce(public.profile_completeness(p) >= 80, false),
    'confirmed', u.email_confirmed_at is not null,
    'published', coalesce(p.status = 'published', false),
    'account_age', u.created_at <= now() - interval '14 days'
  )
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  where u.id = p_user;
$$;
revoke all on function public.mentor_checks(uuid) from public, anon, authenticated;

create or replace function public.wallet_balances(p_user uuid)
returns table (available_kobo integer, pending_kobo integer, next_release timestamptz)
language sql
stable
set search_path = ''
as $$
  select
    coalesce(sum(l.amount_kobo) filter (where l.available_at <= now()), 0)::integer,
    coalesce(sum(l.amount_kobo) filter (where l.available_at > now()), 0)::integer,
    min(l.available_at) filter (where l.available_at > now())
  from public.wallet_ledger l
  where l.user_id = p_user;
$$;
revoke all on function public.wallet_balances(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- For mentors
-- ---------------------------------------------------------------------------

create or replace function public.my_mentor_status()
returns table (
  status text, price_kobo integer, accepting boolean, checks jsonb,
  active_subscribers integer, applied_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.status, m.price_kobo, m.accepting, public.mentor_checks(auth.uid()),
    (select count(*)::integer from public.conversations c where c.mentor_id = auth.uid() and c.access_until > now()),
    m.applied_at
  from (select 1) one
  left join public.mentor_settings m on m.user_id = auth.uid();
$$;
revoke all on function public.my_mentor_status() from public;
revoke execute on function public.my_mentor_status() from anon;
grant execute on function public.my_mentor_status() to authenticated;

create or replace function public.apply_as_mentor()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_checks jsonb := public.mentor_checks(auth.uid());
begin
  if auth.uid() is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if exists (select 1 from jsonb_each(v_checks) c where c.value = 'false'::jsonb) then
    raise exception 'Not eligible yet' using errcode = '42501';
  end if;
  insert into public.mentor_settings (user_id) values (auth.uid())
  on conflict (user_id) do update set status = 'applied', applied_at = now(), decided_at = null
    where public.mentor_settings.status = 'rejected';
end;
$$;
revoke all on function public.apply_as_mentor() from public;
revoke execute on function public.apply_as_mentor() from anon;
grant execute on function public.apply_as_mentor() to authenticated;

create or replace function public.set_mentor_offer(p_price_kobo integer, p_accepting boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_price_kobo is null or p_price_kobo < 200000 or p_price_kobo > 2000000 or p_price_kobo % 10000 <> 0 then
    raise exception 'Price must be between N2,000 and N20,000' using errcode = '22023';
  end if;
  update public.mentor_settings set price_kobo = p_price_kobo, accepting = coalesce(p_accepting, true)
  where user_id = auth.uid() and status = 'approved';
  if not found then
    raise exception 'Not an approved mentor' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.set_mentor_offer(integer, boolean) from public;
revoke execute on function public.set_mentor_offer(integer, boolean) from anon;
grant execute on function public.set_mentor_offer(integer, boolean) to authenticated;

create or replace function public.my_wallet()
returns table (
  available_kobo integer, pending_kobo integer, next_release timestamptz,
  earned_kobo integer, withdrawn_kobo integer,
  bank_name text, account_last4 text, account_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.available_kobo, b.pending_kobo, b.next_release,
    (select coalesce(sum(l.amount_kobo), 0)::integer from public.wallet_ledger l where l.user_id = auth.uid() and l.kind in ('earning', 'refund')),
    (select coalesce(sum(w.amount_kobo), 0)::integer from public.withdrawals w where w.user_id = auth.uid() and w.status = 'paid'),
    a.bank_name, a.account_last4, a.account_name
  from public.wallet_balances(auth.uid()) b
  left join public.payout_accounts a on a.user_id = auth.uid();
$$;
revoke all on function public.my_wallet() from public;
revoke execute on function public.my_wallet() from anon;
grant execute on function public.my_wallet() to authenticated;

create or replace function public.my_wallet_activity()
returns table (kind text, amount_kobo integer, available_at timestamptz, created_at timestamptz, detail text)
language sql
stable
security definer
set search_path = ''
as $$
  select l.kind, l.amount_kobo, l.available_at, l.created_at,
    case
      when l.kind in ('earning', 'refund') then coalesce(p.full_name, 'A member')
      when l.kind in ('withdrawal', 'withdrawal_reversal') then w.bank_name || ' ••' || w.account_last4 || ' · ' || w.status
      else null
    end
  from public.wallet_ledger l
  left join public.payments pay on pay.id = l.payment_id
  left join public.profiles p on p.user_id = pay.user_id
  left join public.withdrawals w on w.id = l.withdrawal_id
  where l.user_id = auth.uid()
  order by l.created_at desc, l.id desc
  limit 100;
$$;
revoke all on function public.my_wallet_activity() from public;
revoke execute on function public.my_wallet_activity() from anon;
grant execute on function public.my_wallet_activity() to authenticated;

-- Ask to withdraw. The money leaves the available balance at once (held for the
-- withdrawal) and comes back if the admin rejects it or the transfer fails.
create or replace function public.request_withdrawal(p_amount_kobo integer)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  a public.payout_accounts%rowtype;
  v_available integer;
  v_id bigint;
begin
  if not exists (select 1 from public.mentor_settings m where m.user_id = v_user and m.status in ('approved', 'paused')) then
    raise exception 'Not a mentor' using errcode = '42501';
  end if;
  select * into a from public.payout_accounts x where x.user_id = v_user;
  if not found then
    raise exception 'Add a bank account first' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('wallet:' || v_user::text));
  select b.available_kobo into v_available from public.wallet_balances(v_user) b;
  if p_amount_kobo is null or p_amount_kobo < 500000 then
    raise exception 'The minimum withdrawal is N5,000' using errcode = '22023';
  end if;
  if p_amount_kobo > v_available then
    raise exception 'More than your available balance' using errcode = '22023';
  end if;
  insert into public.withdrawals (user_id, amount_kobo, reference, bank_name, account_last4, account_name, recipient_code)
  values (v_user, p_amount_kobo, 'mwp_' || replace(gen_random_uuid()::text, '-', ''), a.bank_name, a.account_last4, a.account_name, a.recipient_code)
  returning id into v_id;
  insert into public.wallet_ledger (user_id, amount_kobo, kind, withdrawal_id) values (v_user, -p_amount_kobo, 'withdrawal', v_id);
  return v_id;
end;
$$;
revoke all on function public.request_withdrawal(integer) from public;
revoke execute on function public.request_withdrawal(integer) from anon;
grant execute on function public.request_withdrawal(integer) to authenticated;

create or replace function public.my_withdrawals()
returns table (id bigint, amount_kobo integer, status text, bank_name text, account_last4 text, created_at timestamptz, paid_at timestamptz, note text)
language sql
stable
security definer
set search_path = ''
as $$
  select w.id, w.amount_kobo, w.status, w.bank_name, w.account_last4, w.created_at, w.paid_at, w.note
  from public.withdrawals w where w.user_id = auth.uid()
  order by w.created_at desc limit 50;
$$;
revoke all on function public.my_withdrawals() from public;
revoke execute on function public.my_withdrawals() from anon;
grant execute on function public.my_withdrawals() to authenticated;

-- ---------------------------------------------------------------------------
-- For everyone: is this card's owner taking paid messages?
-- ---------------------------------------------------------------------------

create or replace function public.mentor_offer(p_slug text)
returns table (price_kobo integer, first_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.price_kobo, split_part(btrim(p.full_name), ' ', 1)
  from public.profiles p
  join public.mentor_settings m on m.user_id = p.user_id
  where p.slug = lower(p_slug) and p.status = 'published' and m.status = 'approved' and m.accepting;
$$;
revoke all on function public.mentor_offer(text) from public;
grant execute on function public.mentor_offer(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- For members: paying to message a mentor
-- ---------------------------------------------------------------------------

-- Starts a 30-day subscription purchase. Returns what the app needs for
-- Paystack's checkout; the price and the mentor's 80% are fixed here.
create or replace function public.start_subscription_purchase(p_slug text)
returns table (reference text, amount_kobo integer, email text, mentor_name text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_mentor uuid;
  v_price integer;
  v_name text;
  v_email text;
  v_ref text;
begin
  if v_user is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select p.user_id, m.price_kobo, p.full_name into v_mentor, v_price, v_name
  from public.profiles p join public.mentor_settings m on m.user_id = p.user_id
  where p.slug = lower(p_slug) and p.status = 'published' and m.status = 'approved' and m.accepting;
  if v_mentor is null then
    raise exception 'Not taking messages' using errcode = '22023';
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
  select u.email::text into v_email from auth.users u where u.id = v_user;
  v_ref := 'mw_' || replace(gen_random_uuid()::text, '-', '');
  insert into public.payments (reference, user_id, kind, mentor_id, days, amount_kobo, mentor_share_kobo)
  values (v_ref, v_user, 'subscription', v_mentor, 30, v_price, (v_price * 80) / 100);
  return query select v_ref, v_price, v_email, v_name;
end;
$$;
revoke all on function public.start_subscription_purchase(text) from public;
revoke execute on function public.start_subscription_purchase(text) from anon;
grant execute on function public.start_subscription_purchase(text) to authenticated;

-- ---------------------------------------------------------------------------
-- For the server (secret-protected)
-- ---------------------------------------------------------------------------

-- Confirms a paid payment once. Credits: adds them. Subscription: opens (or
-- extends) the conversation for 30 days and puts the mentor's 80% in their
-- wallet, withdrawable after 7 days. Returns what kind it was, for the return page.
drop function if exists public.confirm_payment(text, text, integer, text, bigint);
create function public.confirm_payment(
  p_token text, p_reference text, p_amount_kobo integer, p_currency text, p_paystack_id bigint
)
returns table (added boolean, credits integer, user_id uuid, kind text, conversation_id bigint)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_pay public.payments%rowtype;
  v_conv bigint;
begin
  perform public.check_cron_token(p_token);
  select * into v_pay from public.payments p where p.reference = p_reference for update;
  if not found then
    raise exception 'Unknown payment' using errcode = '22023';
  end if;
  if v_pay.kind = 'subscription' then
    select c.id into v_conv from public.conversations c where c.member_id = v_pay.user_id and c.mentor_id = v_pay.mentor_id;
  end if;
  if v_pay.status in ('success', 'refunded') then
    return query select false, v_pay.credits, v_pay.user_id, v_pay.kind, v_conv;
    return;
  end if;
  if p_amount_kobo is distinct from v_pay.amount_kobo or upper(coalesce(p_currency, '')) <> v_pay.currency then
    raise exception 'Amount or currency does not match' using errcode = '22023';
  end if;
  update public.payments set status = 'success', paid_at = now(), paystack_id = p_paystack_id where id = v_pay.id;

  if v_pay.kind = 'credits' then
    insert into public.credit_ledger (user_id, delta, reason, payment_id)
    values (v_pay.user_id, v_pay.credits, 'purchase', v_pay.id);
  else
    insert into public.conversations (member_id, mentor_id, access_until)
    values (v_pay.user_id, v_pay.mentor_id, now() + make_interval(days => v_pay.days))
    on conflict (member_id, mentor_id) do update
      set access_until = greatest(public.conversations.access_until, now()) + make_interval(days => v_pay.days)
    returning id into v_conv;
    if v_pay.mentor_share_kobo > 0 then
      insert into public.wallet_ledger (user_id, amount_kobo, kind, payment_id, available_at)
      values (v_pay.mentor_id, v_pay.mentor_share_kobo, 'earning', v_pay.id, now() + interval '7 days');
    end if;
  end if;
  return query select true, v_pay.credits, v_pay.user_id, v_pay.kind, v_conv;
end;
$$;
revoke all on function public.confirm_payment(text, text, integer, text, bigint) from public;
grant execute on function public.confirm_payment(text, text, integer, text, bigint) to anon, authenticated;

-- Saves a mentor's bank account after the server checked it with Paystack.
create or replace function public.save_payout_account(
  p_token text, p_user uuid, p_bank_code text, p_bank_name text, p_last4 text, p_account_name text, p_recipient_code text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.check_cron_token(p_token);
  insert into public.payout_accounts (user_id, bank_code, bank_name, account_last4, account_name, recipient_code)
  values (p_user, p_bank_code, p_bank_name, p_last4, p_account_name, p_recipient_code)
  on conflict (user_id) do update set bank_code = excluded.bank_code, bank_name = excluded.bank_name,
    account_last4 = excluded.account_last4, account_name = excluded.account_name,
    recipient_code = excluded.recipient_code, verified_at = now();
end;
$$;
revoke all on function public.save_payout_account(text, uuid, text, text, text, text, text) from public;
grant execute on function public.save_payout_account(text, uuid, text, text, text, text, text) to anon, authenticated;

-- Paystack's answer about a withdrawal transfer (from the webhook or the admin step).
create or replace function public.record_transfer_result(p_token text, p_reference text, p_result text, p_transfer_code text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  w public.withdrawals%rowtype;
begin
  perform public.check_cron_token(p_token);
  select * into w from public.withdrawals x where x.reference = p_reference for update;
  if not found or w.status in ('paid', 'failed', 'rejected') then
    return;
  end if;
  if p_result = 'success' then
    update public.withdrawals set status = 'paid', paid_at = now(), transfer_code = coalesce(p_transfer_code, transfer_code) where id = w.id;
  elsif p_result = 'processing' then
    update public.withdrawals set status = 'processing', transfer_code = coalesce(p_transfer_code, transfer_code) where id = w.id;
  elsif p_result in ('failed', 'reversed') then
    update public.withdrawals set status = 'failed', note = 'The bank transfer didn''t go through' where id = w.id;
    insert into public.wallet_ledger (user_id, amount_kobo, kind, withdrawal_id) values (w.user_id, w.amount_kobo, 'withdrawal_reversal', w.id);
  end if;
end;
$$;
revoke all on function public.record_transfer_result(text, text, text, text) from public;
grant execute on function public.record_transfer_result(text, text, text, text) to anon, authenticated;

-- Members whose subscription ends in about 3 days, once per period.
create or replace function public.claim_subscription_reminders(p_token text)
returns table (email text, member_name text, mentor_name text, mentor_slug text, access_until timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.check_cron_token(p_token);
  return query
  with due as (
    select c.id, c.access_until from public.conversations c
    where c.access_until between now() + interval '2 days' and now() + interval '3 days'
      and exists (select 1 from public.payments p where p.user_id = c.member_id and p.mentor_id = c.mentor_id and p.status = 'success')
      and not exists (select 1 from public.subscription_reminders_sent s where s.conversation_id = c.id and s.access_until = c.access_until)
  ),
  claimed as (
    insert into public.subscription_reminders_sent (conversation_id, access_until)
    select d.id, d.access_until from due d on conflict do nothing
    returning conversation_id
  )
  select u.email::text, mp.full_name, tp.full_name, tp.slug, c.access_until
  from claimed cl
  join public.conversations c on c.id = cl.conversation_id
  join auth.users u on u.id = c.member_id
  left join public.profiles mp on mp.user_id = c.member_id
  left join public.profiles tp on tp.user_id = c.mentor_id;
end;
$$;
revoke all on function public.claim_subscription_reminders(text) from public;
grant execute on function public.claim_subscription_reminders(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- For admins
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_mentors()
returns table (
  email text, full_name text, slug text, experience_years smallint, status text, price_kobo integer,
  accepting boolean, checks jsonb, applied_at timestamptz, active_subscribers integer,
  earned_kobo integer, available_kobo integer, pending_kobo integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
    select u.email::text, p.full_name, p.slug, p.experience_years, m.status, m.price_kobo, m.accepting,
      public.mentor_checks(m.user_id), m.applied_at,
      (select count(*)::integer from public.conversations c where c.mentor_id = m.user_id and c.access_until > now()),
      (select coalesce(sum(l.amount_kobo), 0)::integer from public.wallet_ledger l where l.user_id = m.user_id and l.kind in ('earning', 'refund')),
      b.available_kobo, b.pending_kobo
    from public.mentor_settings m
    join auth.users u on u.id = m.user_id
    left join public.profiles p on p.user_id = m.user_id
    cross join lateral public.wallet_balances(m.user_id) b
    order by (m.status = 'applied') desc, m.applied_at desc;
end;
$$;
revoke all on function public.admin_list_mentors() from public;
revoke execute on function public.admin_list_mentors() from anon;
grant execute on function public.admin_list_mentors() to authenticated;

-- Approve, reject or pause a mentor. Returns their email and first name for the email.
create or replace function public.admin_decide_mentor(p_email text, p_status text)
returns table (email text, first_name text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_status not in ('approved', 'rejected', 'paused') then
    raise exception 'Unknown status' using errcode = '22023';
  end if;
  select u.id into v_user from auth.users u where lower(u.email) = lower(btrim(p_email));
  update public.mentor_settings set status = p_status, decided_at = now() where user_id = v_user;
  if not found then
    raise exception 'No mentor application for that email' using errcode = '22023';
  end if;
  return query
    select u.email::text, split_part(btrim(coalesce(p.full_name, '')), ' ', 1)
    from auth.users u left join public.profiles p on p.user_id = u.id where u.id = v_user;
end;
$$;
revoke all on function public.admin_decide_mentor(text, text) from public;
revoke execute on function public.admin_decide_mentor(text, text) from anon;
grant execute on function public.admin_decide_mentor(text, text) to authenticated;

-- Paid subscriptions, with whether the mentor has replied since (for the
-- "no reply in 7 days, full refund" promise).
create or replace function public.admin_list_subscriptions()
returns table (
  reference text, member_email text, mentor_email text, amount_kobo integer, mentor_share_kobo integer,
  status text, paid_at timestamptz, access_until timestamptz, mentor_replied boolean, refund_due boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
    select p.reference, mu.email::text, tu.email::text, p.amount_kobo, p.mentor_share_kobo, p.status, p.paid_at,
      c.access_until, r.replied,
      p.status = 'success' and not r.replied and p.paid_at < now() - interval '7 days'
    from public.payments p
    join auth.users mu on mu.id = p.user_id
    join auth.users tu on tu.id = p.mentor_id
    left join public.conversations c on c.member_id = p.user_id and c.mentor_id = p.mentor_id
    cross join lateral (
      select exists (select 1 from public.messages m where m.conversation_id = c.id and m.sender_id = p.mentor_id and m.created_at >= p.paid_at) as replied
    ) r
    where p.kind = 'subscription' and p.status in ('success', 'refunded')
    order by p.paid_at desc
    limit 200;
end;
$$;
revoke all on function public.admin_list_subscriptions() from public;
revoke execute on function public.admin_list_subscriptions() from anon;
grant execute on function public.admin_list_subscriptions() to authenticated;

-- After the money was refunded in Paystack: take the mentor's share back out
-- of their wallet and end the member's access.
create or replace function public.admin_mark_refunded(p_reference text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_pay public.payments%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into v_pay from public.payments p where p.reference = p_reference and p.kind = 'subscription' for update;
  if not found or v_pay.status <> 'success' then
    raise exception 'Not a paid subscription' using errcode = '22023';
  end if;
  update public.payments set status = 'refunded' where id = v_pay.id;
  if v_pay.mentor_share_kobo > 0 then
    insert into public.wallet_ledger (user_id, amount_kobo, kind, payment_id)
    values (v_pay.mentor_id, -v_pay.mentor_share_kobo, 'refund', v_pay.id);
  end if;
  update public.conversations set access_until = least(access_until, now())
  where member_id = v_pay.user_id and mentor_id = v_pay.mentor_id;
end;
$$;
revoke all on function public.admin_mark_refunded(text) from public;
revoke execute on function public.admin_mark_refunded(text) from anon;
grant execute on function public.admin_mark_refunded(text) to authenticated;

create or replace function public.admin_list_withdrawals()
returns table (
  id bigint, email text, full_name text, amount_kobo integer, status text, reference text,
  bank_name text, account_last4 text, account_name text, created_at timestamptz, paid_at timestamptz, note text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
    select w.id, u.email::text, p.full_name, w.amount_kobo, w.status, w.reference, w.bank_name, w.account_last4,
      w.account_name, w.created_at, w.paid_at, w.note
    from public.withdrawals w
    join auth.users u on u.id = w.user_id
    left join public.profiles p on p.user_id = w.user_id
    order by (w.status in ('requested', 'processing')) desc, w.created_at desc
    limit 200;
end;
$$;
revoke all on function public.admin_list_withdrawals() from public;
revoke execute on function public.admin_list_withdrawals() from anon;
grant execute on function public.admin_list_withdrawals() to authenticated;

-- Approve: hands the server what it needs to send the Paystack transfer.
create or replace function public.admin_approve_withdrawal(p_id bigint)
returns table (reference text, amount_kobo integer, recipient_code text, email text, first_name text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.withdrawals set status = 'processing', decided_at = now() where id = p_id and status = 'requested';
  if not found then
    raise exception 'Not waiting for approval' using errcode = '22023';
  end if;
  return query
    select w.reference, w.amount_kobo, w.recipient_code, u.email::text, split_part(btrim(coalesce(p.full_name, '')), ' ', 1)
    from public.withdrawals w join auth.users u on u.id = w.user_id
    left join public.profiles p on p.user_id = w.user_id
    where w.id = p_id;
end;
$$;
revoke all on function public.admin_approve_withdrawal(bigint) from public;
revoke execute on function public.admin_approve_withdrawal(bigint) from anon;
grant execute on function public.admin_approve_withdrawal(bigint) to authenticated;

create or replace function public.admin_reject_withdrawal(p_id bigint, p_note text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  w public.withdrawals%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into w from public.withdrawals x where x.id = p_id for update;
  if not found or w.status <> 'requested' then
    raise exception 'Not waiting for approval' using errcode = '22023';
  end if;
  update public.withdrawals set status = 'rejected', decided_at = now(), note = nullif(left(btrim(coalesce(p_note, '')), 300), '') where id = w.id;
  insert into public.wallet_ledger (user_id, amount_kobo, kind, withdrawal_id) values (w.user_id, w.amount_kobo, 'withdrawal_reversal', w.id);
end;
$$;
revoke all on function public.admin_reject_withdrawal(bigint, text) from public;
revoke execute on function public.admin_reject_withdrawal(bigint, text) from anon;
grant execute on function public.admin_reject_withdrawal(bigint, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin overview: revenue is Meetwell's share (mentors' 80% is theirs)
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
    -- Meetwell's share: all of a credits payment, 20% of a subscription.
    select p.user_id, p.amount_kobo - coalesce(p.mentor_share_kobo, 0) as amount_kobo, coalesce(p.credits, 0) as credits, p.paid_at
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
