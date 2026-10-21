-- "Feature a member" emails: an admin introduces a member with a published card
-- to the waiting list.
--
-- Audience: people on the waiting list who haven't signed up (no account with
-- that email) and haven't unsubscribed from updates. The featured member is
-- never emailed about themselves. Each person gets each feature at most once.

create table if not exists public.feature_emails_sent (
  profile_slug text not null,
  email text not null,
  sent_at timestamptz not null default now(),
  primary key (profile_slug, email)
);
alter table public.feature_emails_sent enable row level security;
revoke all on public.feature_emails_sent from anon, authenticated;

-- Shared rule for who is eligible to receive a given feature (not yet sent).
create or replace function public.feature_audience(p_slug text)
returns table (email text, full_name text, unsubscribe_token uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select w.email, w.full_name, w.unsubscribe_token
  from public.waitlist w
  where w.unsubscribed_at is null
    and not exists (select 1 from auth.users u where lower(u.email) = w.email)
    and not exists (
      select 1 from public.profiles p
      join auth.users u on u.id = p.user_id
      where p.slug = lower(trim(p_slug)) and lower(u.email) = w.email
    )
    and not exists (
      select 1 from public.feature_emails_sent f
      where f.profile_slug = lower(trim(p_slug)) and f.email = w.email
    )
  order by w.created_at;
$$;
-- Internal helper: only the admin functions below may use it.
revoke all on function public.feature_audience(text) from public, anon, authenticated;

create or replace function public.feature_card_is_published(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p where p.slug = lower(trim(p_slug)) and p.status = 'published'
  );
$$;
revoke all on function public.feature_card_is_published(text) from public, anon, authenticated;

-- How many people would receive this feature right now. Admins only.
create or replace function public.admin_feature_audience_count(p_slug text)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not public.feature_card_is_published(p_slug) then
    raise exception 'That card is not published' using errcode = 'P0002';
  end if;
  return (select count(*)::integer from public.feature_audience(p_slug));
end;
$$;
revoke all on function public.admin_feature_audience_count(text) from public;
revoke execute on function public.admin_feature_audience_count(text) from anon;
grant execute on function public.admin_feature_audience_count(text) to authenticated;

-- Returns the next batch of recipients and records them as sent in one step,
-- so a feature can't go to the same person twice. Admins only.
create or replace function public.admin_claim_feature_recipients(p_slug text, p_limit integer default 80)
returns table (email text, full_name text, unsubscribe_token uuid)
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
  if not public.feature_card_is_published(p_slug) then
    raise exception 'That card is not published' using errcode = 'P0002';
  end if;
  return query
  with due as (
    select a.email, a.full_name, a.unsubscribe_token
    from public.feature_audience(p_slug) a
    limit greatest(least(coalesce(p_limit, 80), 200), 0)
  ),
  claimed as (
    insert into public.feature_emails_sent (profile_slug, email)
    select lower(trim(p_slug)), d.email from due d
    on conflict do nothing
    returning feature_emails_sent.email
  )
  select d.email, d.full_name, d.unsubscribe_token
  from due d
  join claimed c on c.email = d.email;
end;
$$;
revoke all on function public.admin_claim_feature_recipients(text, integer) from public;
revoke execute on function public.admin_claim_feature_recipients(text, integer) from anon;
grant execute on function public.admin_claim_feature_recipients(text, integer) to authenticated;
