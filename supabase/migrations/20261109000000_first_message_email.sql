-- Message emails: only for the first message each person sends in a
-- conversation (so each side gets at most one email per conversation), styled
-- like a LinkedIn message alert: the sender's photo, name, title and a short
-- preview. Still only if the recipient has message emails on.
drop function if exists public.claim_message_email(text, bigint);
create function public.claim_message_email(p_token text, p_message bigint)
returns table (
  email text, full_name text, sender_name text, sender_title text, sender_avatar text,
  preview text, unsubscribe_token uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  m public.messages%rowtype;
  c public.conversations%rowtype;
  v_to uuid;
begin
  perform public.check_cron_token(p_token);
  select * into m from public.messages x where x.id = p_message;
  if not found then return; end if;
  -- Only the sender's first message in this conversation.
  if exists (select 1 from public.messages x
             where x.conversation_id = m.conversation_id and x.sender_id = m.sender_id
               and (x.created_at, x.id) < (m.created_at, m.id)) then
    return;
  end if;
  select * into c from public.conversations x where x.id = m.conversation_id;
  v_to := case when c.member_id = m.sender_id then c.mentor_id else c.member_id end;
  insert into public.email_prefs (user_id) values (v_to) on conflict (user_id) do nothing;
  if not (select e.message_emails from public.email_prefs e where e.user_id = v_to) then return; end if;
  if exists (select 1 from public.message_emails_sent s where s.conversation_id = c.id and s.user_id = v_to) then
    return;
  end if;
  insert into public.message_emails_sent (conversation_id, user_id) values (c.id, v_to);
  return query
    select u.email::text, rp.full_name, coalesce(sp.full_name, 'A Meetwell member'),
      nullif(concat_ws(' · ', sp.professional_title, sp.organization), ''),
      sp.avatar_url,
      case when char_length(m.body) > 220 then left(m.body, 217) || '…' else m.body end,
      e.token
    from auth.users u
    join public.email_prefs e on e.user_id = u.id
    left join public.profiles rp on rp.user_id = u.id
    left join public.profiles sp on sp.user_id = m.sender_id
    where u.id = v_to;
end;
$$;
revoke all on function public.claim_message_email(text, bigint) from public;
grant execute on function public.claim_message_email(text, bigint) to anon, authenticated;
