-- Mentors can take messages for free. A price of 0 means free: members start
-- (or extend) a 30-day conversation with one click, no payment and no wallet
-- entry. Paid prices stay between N2,000 and N20,000.

alter table public.mentor_settings drop constraint if exists mentor_settings_price_kobo_check;
alter table public.mentor_settings add constraint mentor_settings_price_kobo_check
  check (price_kobo = 0 or price_kobo between 200000 and 2000000);

create or replace function public.set_mentor_offer(p_price_kobo integer, p_accepting boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_price_kobo is null or (p_price_kobo <> 0 and (p_price_kobo < 200000 or p_price_kobo > 2000000 or p_price_kobo % 10000 <> 0)) then
    raise exception 'Price must be free, or between N2,000 and N20,000' using errcode = '22023';
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

-- Paid offers can't be bought through Paystack when the mentor is free.
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
  where p.slug = lower(p_slug) and p.status = 'published' and m.status = 'approved' and m.accepting and m.price_kobo > 0;
  if v_mentor is null then
    raise exception 'Not taking paid messages' using errcode = '22023';
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

-- Start (or extend by 30 days) a free conversation with a mentor who takes free
-- messages. Same rules as paying: members under 4 years only, not yourself,
-- not if either has blocked the other. Returns the conversation id.
create or replace function public.start_free_conversation(p_slug text)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_mentor uuid;
  v_conv bigint;
begin
  if v_user is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select p.user_id into v_mentor
  from public.profiles p join public.mentor_settings m on m.user_id = p.user_id
  where p.slug = lower(p_slug) and p.status = 'published' and m.status = 'approved' and m.accepting and m.price_kobo = 0;
  if v_mentor is null then
    raise exception 'Not taking free messages' using errcode = '22023';
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
  insert into public.conversations (member_id, mentor_id, access_until)
  values (v_user, v_mentor, now() + interval '30 days')
  on conflict (member_id, mentor_id) do update
    set access_until = greatest(public.conversations.access_until, now() + interval '30 days')
  returning id into v_conv;
  return v_conv;
end;
$$;
revoke all on function public.start_free_conversation(text) from public;
revoke execute on function public.start_free_conversation(text) from anon;
grant execute on function public.start_free_conversation(text) to authenticated;
