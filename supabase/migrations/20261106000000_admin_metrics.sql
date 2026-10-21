-- Numbers for the admin Overview: growth, engagement, Spark and revenue, plus
-- two short series for charts. Months and weeks are in Lagos time. Admin
-- accounts are left out of member counts. Admins only.
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
    select p.user_id, p.amount_kobo, p.credits, p.paid_at
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
