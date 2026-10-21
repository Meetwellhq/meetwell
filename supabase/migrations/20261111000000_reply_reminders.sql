-- Reply reminders: if the last message in an open conversation has waited more
-- than 4 hours without a reply, email the person it's waiting on, once for
-- that message. Not for messages older than 7 days, not if they blocked the
-- sender, and only if their message emails are on. Called every 15 minutes by
-- Supabase pg_cron (job "reply-reminders") through /api/cron/reply-reminders.

create table if not exists public.message_reminders_sent (
  message_id bigint primary key references public.messages (id) on delete cascade,
  sent_at timestamptz not null default now()
);
alter table public.message_reminders_sent enable row level security;
revoke all on public.message_reminders_sent from anon, authenticated;

create or replace function public.claim_reply_reminders(p_token text, p_limit integer default 40)
returns table (
  email text, full_name text, sender_name text, sender_title text, sender_avatar text,
  preview text, conversation_id bigint, to_mentor boolean, unsubscribe_token uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.check_cron_token(p_token);
  insert into public.email_prefs (user_id)
  select distinct case when c.member_id = lm.sender_id then c.mentor_id else c.member_id end
  from public.conversations c
  cross join lateral (
    select m.sender_id from public.messages m where m.conversation_id = c.id order by m.created_at desc, m.id desc limit 1
  ) lm
  where c.access_until > now()
  on conflict (user_id) do nothing;

  return query
  with waiting as (
    select c.id as conv, lm.id as msg, lm.sender_id, lm.body,
      case when c.member_id = lm.sender_id then c.mentor_id else c.member_id end as to_user,
      c.mentor_id
    from public.conversations c
    cross join lateral (
      select m.* from public.messages m where m.conversation_id = c.id order by m.created_at desc, m.id desc limit 1
    ) lm
    where c.access_until > now()
      and lm.created_at < now() - interval '4 hours'
      and lm.created_at > now() - interval '7 days'
      and not public.is_blocked_between(c.member_id, c.mentor_id)
      and not exists (select 1 from public.message_reminders_sent r where r.message_id = lm.id)
  ),
  due as (
    select w.* from waiting w
    join public.email_prefs e on e.user_id = w.to_user and e.message_emails
    limit greatest(least(coalesce(p_limit, 40), 200), 0)
  ),
  claimed as (
    insert into public.message_reminders_sent (message_id)
    select d.msg from due d on conflict do nothing
    returning message_id
  )
  select u.email::text, rp.full_name, coalesce(sp.full_name, 'A Meetwell member'),
    nullif(concat_ws(' · ', sp.professional_title, sp.organization), ''),
    sp.avatar_url,
    case when char_length(d.body) > 220 then left(d.body, 217) || '…' else d.body end,
    d.conv, d.to_user = d.mentor_id, e.token
  from due d
  join claimed cl on cl.message_id = d.msg
  join auth.users u on u.id = d.to_user
  join public.email_prefs e on e.user_id = d.to_user
  left join public.profiles rp on rp.user_id = d.to_user
  left join public.profiles sp on sp.user_id = d.sender_id;
end;
$$;
revoke all on function public.claim_reply_reminders(text, integer) from public;
grant execute on function public.claim_reply_reminders(text, integer) to anon, authenticated;
