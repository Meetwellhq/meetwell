-- Payment history for members: their own paid (and refunded) payments, newest
-- first. Credits show how many; mentor subscriptions show who and for how long.
create or replace function public.my_payments()
returns table (
  reference text, kind text, credits integer, days integer, mentor_name text,
  amount_kobo integer, status text, paid_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.reference, p.kind, p.credits, p.days, mp.full_name, p.amount_kobo, p.status, p.paid_at
  from public.payments p
  left join public.profiles mp on mp.user_id = p.mentor_id
  where p.user_id = auth.uid() and p.status in ('success', 'refunded')
  order by p.paid_at desc nulls last
  limit 100;
$$;
revoke all on function public.my_payments() from public;
revoke execute on function public.my_payments() from anon;
grant execute on function public.my_payments() to authenticated;
