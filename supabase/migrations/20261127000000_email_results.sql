-- Results for emails sent from the admin's New email page:
--   * did people do what the email asked (worked out from their profile now);
--   * delivered, opened, clicked and bounced, from Resend's webhook.
-- Each send keeps Resend's email id so its events can be matched to it.

alter table public.email_sends
  add column if not exists resend_id text unique,
  add column if not exists delivered_at timestamptz,
  add column if not exists opened_at timestamptz,
  add column if not exists clicked_at timestamptz,
  add column if not exists bounced_at timestamptz;

-- Record one send, after the email went out, with Resend's id when we have it.
drop function if exists public.admin_record_email_send(text, text);
create function public.admin_record_email_send(p_template text, p_email text, p_resend_id text default null)
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
  insert into public.email_sends (template, email, resend_id) values (p_template, p_email, nullif(p_resend_id, ''));
end;
$$;
revoke all on function public.admin_record_email_send(text, text, text) from public;
revoke execute on function public.admin_record_email_send(text, text, text) from anon;
grant execute on function public.admin_record_email_send(text, text, text) to authenticated;

-- One event from Resend's webhook (our route checks Resend's signature, then
-- calls this with the cron secret). Only the first of each kind is kept. A click
-- also counts as an open, since many email apps block the open pixel.
-- Returns false when the email isn't one of ours (for example a reminder).
create or replace function public.record_email_event(p_token text, p_resend_id text, p_type text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.check_cron_token(p_token);
  if p_type not in ('delivered', 'opened', 'clicked', 'bounced') then
    return false;
  end if;
  update public.email_sends s set
    delivered_at = case when p_type = 'delivered' then coalesce(s.delivered_at, now()) else s.delivered_at end,
    opened_at = case when p_type in ('opened', 'clicked') then coalesce(s.opened_at, now()) else s.opened_at end,
    clicked_at = case when p_type = 'clicked' then coalesce(s.clicked_at, now()) else s.clicked_at end,
    bounced_at = case when p_type = 'bounced' then coalesce(s.bounced_at, now()) else s.bounced_at end
  where s.resend_id = p_resend_id;
  return found;
end;
$$;
revoke all on function public.record_email_event(text, text, text) from public;
grant execute on function public.record_email_event(text, text, text) to anon, authenticated;

-- Results by email and day (Lagos time), newest first. "acted" counts people
-- who have now done what the email asked.
drop function if exists public.admin_email_history();
create function public.admin_email_results()
returns table (
  template text, sent_on date, people integer,
  delivered integer, opened integer, clicked integer, bounced integer, acted integer
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
    select
      s.template,
      (s.sent_at at time zone 'Africa/Lagos')::date,
      count(*)::integer,
      count(s.delivered_at)::integer,
      count(s.opened_at)::integer,
      count(s.clicked_at)::integer,
      count(s.bounced_at)::integer,
      (count(*) filter (where case s.template
        when 'publish_card' then p.status = 'published'
        when 'add_photo' then p.avatar_url is not null
        when 'finish_profile' then p.id is not null and public.profile_completeness(p) >= 80
        when 'spark_beta' then p.matching_opt_in
        when 'mentoring' then p.experience_years is not null
        else false
      end))::integer
    from public.email_sends s
    left join auth.users u on lower(u.email) = lower(s.email)
    left join public.profiles p on p.user_id = u.id
    group by 1, 2
    order by 2 desc, 1
    limit 50;
end;
$$;
revoke all on function public.admin_email_results() from public;
revoke execute on function public.admin_email_results() from anon;
grant execute on function public.admin_email_results() to authenticated;
