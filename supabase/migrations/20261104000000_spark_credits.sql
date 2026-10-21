-- Spark credits (paid with Paystack). One credit = one extra Spark introduction
-- after the 5 free ones in a month, still at most one a day. Credits don't
-- expire. Only members under 4 years of experience (who get introductions) buy.
--
-- Money flow: the app asks start_credit_purchase() for a reference and the price
-- (prices live here, never in the browser), sends the member to Paystack, and
-- credits are added only by confirm_payment(), which the server calls after
-- Paystack confirms the payment (webhook with a valid signature, or the return
-- page, both re-checked with Paystack's API). Card details never reach Meetwell.
-- confirm_payment() is protected by the same secret as the daily jobs (CRON_SECRET).

create table if not exists public.credit_packs (
  id text primary key,
  credits integer not null check (credits > 0),
  amount_kobo integer not null check (amount_kobo > 0),
  active boolean not null default true,
  sort integer not null default 0
);
alter table public.credit_packs enable row level security;
revoke all on public.credit_packs from anon, authenticated;

insert into public.credit_packs (id, credits, amount_kobo, sort) values
  ('spark_5', 5, 250000, 1),
  ('spark_15', 15, 600000, 2)
on conflict (id) do nothing;

create table if not exists public.payments (
  id bigint generated always as identity primary key,
  reference text not null unique,
  user_id uuid not null references auth.users (id) on delete cascade,
  pack_id text not null references public.credit_packs (id),
  credits integer not null check (credits > 0),
  amount_kobo integer not null check (amount_kobo > 0),
  currency text not null default 'NGN',
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  paystack_id bigint,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists payments_user_idx on public.payments (user_id, created_at desc);
alter table public.payments enable row level security;
revoke all on public.payments from anon, authenticated;

-- Every credit added or used is one row, so a balance can always be explained.
create table if not exists public.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  delta integer not null check (delta <> 0),
  reason text not null check (reason in ('purchase', 'match', 'refund', 'admin')),
  payment_id bigint unique references public.payments (id) on delete set null,
  match_id bigint unique references public.matches (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists credit_ledger_user_idx on public.credit_ledger (user_id);
alter table public.credit_ledger enable row level security;
revoke all on public.credit_ledger from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------

create or replace function public.spark_credit_balance(p_user_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(l.delta), 0)::integer from public.credit_ledger l where l.user_id = p_user_id;
$$;
revoke all on function public.spark_credit_balance(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- For members
-- ---------------------------------------------------------------------------

create or replace function public.list_credit_packs()
returns table (id text, credits integer, amount_kobo integer)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.credits, p.amount_kobo from public.credit_packs p where p.active order by p.sort;
$$;
revoke all on function public.list_credit_packs() from public;
revoke execute on function public.list_credit_packs() from anon;
grant execute on function public.list_credit_packs() to authenticated;

create or replace function public.my_spark_credits()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select public.spark_credit_balance(auth.uid());
$$;
revoke all on function public.my_spark_credits() from public;
revoke execute on function public.my_spark_credits() from anon;
grant execute on function public.my_spark_credits() to authenticated;

-- Starts a purchase: records a pending payment with a fresh reference and the
-- pack's price, and returns what the app needs to open Paystack's checkout.
create or replace function public.start_credit_purchase(p_pack text)
returns table (reference text, amount_kobo integer, credits integer, email text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_pack public.credit_packs%rowtype;
  v_email text;
  v_ref text;
begin
  if v_user is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into v_pack from public.credit_packs p where p.id = p_pack and p.active;
  if not found then
    raise exception 'Unknown pack' using errcode = '22023';
  end if;
  if exists (select 1 from public.profiles p where p.user_id = v_user and coalesce(p.experience_years, 0) >= 4) then
    raise exception 'Credits are for members under 4 years of experience' using errcode = '42501';
  end if;
  select u.email::text into v_email from auth.users u where u.id = v_user;
  v_ref := 'mw_' || replace(gen_random_uuid()::text, '-', '');
  insert into public.payments (reference, user_id, pack_id, credits, amount_kobo)
  values (v_ref, v_user, v_pack.id, v_pack.credits, v_pack.amount_kobo);
  return query select v_ref, v_pack.amount_kobo, v_pack.credits, v_email;
end;
$$;
revoke all on function public.start_credit_purchase(text) from public;
revoke execute on function public.start_credit_purchase(text) from anon;
grant execute on function public.start_credit_purchase(text) to authenticated;

-- ---------------------------------------------------------------------------
-- For the server (secret-protected), after Paystack confirms a payment
-- ---------------------------------------------------------------------------

-- Marks the payment paid and adds its credits, once. Refuses if the amount or
-- currency Paystack reports doesn't match what we asked for. Returns whether
-- this call added the credits (false if they were added before).
create or replace function public.confirm_payment(
  p_token text, p_reference text, p_amount_kobo integer, p_currency text, p_paystack_id bigint
)
returns table (added boolean, credits integer, user_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_pay public.payments%rowtype;
begin
  perform public.check_cron_token(p_token);
  select * into v_pay from public.payments p where p.reference = p_reference for update;
  if not found then
    raise exception 'Unknown payment' using errcode = '22023';
  end if;
  if v_pay.status = 'success' then
    return query select false, v_pay.credits, v_pay.user_id;
    return;
  end if;
  if p_amount_kobo is distinct from v_pay.amount_kobo or upper(coalesce(p_currency, '')) <> v_pay.currency then
    raise exception 'Amount or currency does not match' using errcode = '22023';
  end if;
  update public.payments set status = 'success', paid_at = now(), paystack_id = p_paystack_id where id = v_pay.id;
  insert into public.credit_ledger (user_id, delta, reason, payment_id)
  values (v_pay.user_id, v_pay.credits, 'purchase', v_pay.id);
  return query select true, v_pay.credits, v_pay.user_id;
end;
$$;
revoke all on function public.confirm_payment(text, text, integer, text, bigint) from public;
grant execute on function public.confirm_payment(text, text, integer, text, bigint) to anon;

create or replace function public.mark_payment_failed(p_token text, p_reference text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.check_cron_token(p_token);
  update public.payments set status = 'failed' where reference = p_reference and status = 'pending';
end;
$$;
revoke all on function public.mark_payment_failed(text, text) from public;
grant execute on function public.mark_payment_failed(text, text) to anon;

-- ---------------------------------------------------------------------------
-- Matching: credits continue introductions after the free 5
-- ---------------------------------------------------------------------------

create or replace function public.matching_due_users(p_token text, p_limit integer default 40)
returns table (
  user_id uuid, email text, profile_id uuid, full_name text, title text, organization text, bio text,
  field text, experience_years smallint, looking_for text[], city text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.check_cron_token(p_token);
  return query
    select u.id, u.email::text, p.id, p.full_name, p.professional_title, p.organization, p.bio,
      p.field, p.experience_years, p.looking_for, p.city
    from public.profiles p
    join auth.users u on u.id = p.user_id
    where p.matching_opt_in
      and p.status = 'published'
      and p.field is not null
      and p.experience_years is not null
      and p.experience_years < 4
      and u.email_confirmed_at is not null
      and public.profile_completeness(p) >= 80
      and not exists (select 1 from public.matches m
           where m.user_id = u.id and m.created_at > now() - interval '20 hours')
      and (public.spark_matches_this_month(u.id) < 5 or public.spark_credit_balance(u.id) > 0)
    order by random()
    limit greatest(least(coalesce(p_limit, 40), 200), 0);
end;
$$;
revoke all on function public.matching_due_users(text, integer) from public;
grant execute on function public.matching_due_users(text, integer) to anon;

-- Records a match. After the free 5 this month it uses one credit, in the same
-- step. Returns the match id, or null if it was already recorded, the member
-- had one in the last 20 hours, or they're out of free matches and credits.
create or replace function public.record_match(p_token text, p_user_id uuid, p_profile_id uuid, p_reason text)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_paid boolean;
begin
  perform public.check_cron_token(p_token);
  -- One member at a time, so two runs can't spend the same credit.
  perform pg_advisory_xact_lock(hashtext('record_match:' || p_user_id::text));
  if exists (select 1 from public.matches m
             where m.user_id = p_user_id and m.created_at > now() - interval '20 hours') then
    return null;
  end if;
  v_paid := public.spark_matches_this_month(p_user_id) >= 5;
  if v_paid and public.spark_credit_balance(p_user_id) <= 0 then
    return null;
  end if;
  insert into public.matches (user_id, matched_profile_id, reason)
  values (p_user_id, p_profile_id, left(btrim(p_reason), 600))
  on conflict (user_id, matched_profile_id) do nothing
  returning id into v_id;
  if v_id is not null and v_paid then
    insert into public.credit_ledger (user_id, delta, reason, match_id) values (p_user_id, -1, 'match', v_id);
  end if;
  return v_id;
end;
$$;
revoke all on function public.record_match(text, uuid, uuid, text) from public;
grant execute on function public.record_match(text, uuid, uuid, text) to anon;

-- ---------------------------------------------------------------------------
-- Admin: payments on the Invites tab
-- ---------------------------------------------------------------------------

create or replace function public.admin_list_payments()
returns table (
  email text, reference text, credits integer, amount_kobo integer, status text,
  created_at timestamptz, paid_at timestamptz
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
    select u.email::text, p.reference, p.credits, p.amount_kobo, p.status, p.created_at, p.paid_at
    from public.payments p
    join auth.users u on u.id = p.user_id
    order by p.created_at desc
    limit 200;
end;
$$;
revoke all on function public.admin_list_payments() from public;
revoke execute on function public.admin_list_payments() from anon;
grant execute on function public.admin_list_payments() to authenticated;
