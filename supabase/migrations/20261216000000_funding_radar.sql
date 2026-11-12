-- Funding radar: grants, accelerators, competitions and fellowships that suit
-- Meetwell, found by a weekly search, so the founder can apply in good time.
--
-- Admin only. Nothing here applies or sends anything: the page lists each
-- opportunity with its deadline and a stage the founder moves along. New finds
-- come from the weekly search through funding_import() (cron secret, like the
-- partner radar), or are added by hand on the page.

create table if not exists public.funding_opportunities (
  -- A readable id from the name ('google-for-startups-accelerator-africa-class-10'),
  -- so a weekly search that finds the same programme again doesn't add it twice
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  funder text check (funder is null or char_length(funder) <= 200),
  kind text not null default 'grant' check (kind in ('grant', 'accelerator', 'competition', 'fellowship', 'investor', 'loan', 'other')),
  -- In the funder's own words, e.g. 'Up to $100,000 equity-free'
  amount text check (amount is null or char_length(amount) <= 160),
  -- True when they take no shares, false when they do, null when unclear
  equity_free boolean,
  -- Null for rolling or not yet announced
  deadline date,
  region text not null default 'Africa' check (region in ('Nigeria', 'Africa', 'Global')),
  link text check (link is null or (char_length(link) <= 500 and link ~ '^https?://')),
  eligibility text check (eligibility is null or char_length(eligibility) <= 1500),
  fit text check (fit is null or char_length(fit) <= 1500),
  prepare text check (prepare is null or char_length(prepare) <= 1500),
  status text not null default 'new' check (status in ('new', 'preparing', 'applied', 'shortlisted', 'won', 'rejected', 'skipped')),
  notes text check (notes is null or char_length(notes) <= 4000),
  source text not null default 'manual' check (source in ('manual', 'weekly-search')),
  found_on date not null default (now() at time zone 'Africa/Lagos')::date,
  applied_on date,
  -- When the daily job last emailed the founder that the deadline is a week away (once each)
  reminded_on date,
  updated_at timestamptz not null default now()
);

alter table public.funding_opportunities enable row level security;
revoke all on public.funding_opportunities from anon, authenticated;

-- Turns a name into an id
create or replace function public.funding_id(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(regexp_replace(regexp_replace(lower(btrim(coalesce(p_name, ''))), '[^a-z0-9]+', '-', 'g'), '(^-+|-+$)', '', 'g'), 80);
$$;

-- Every opportunity, nearest deadline first, rolling ones last
create or replace function public.admin_list_funding()
returns setof public.funding_opportunities
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query select * from public.funding_opportunities f order by f.deadline nulls last, f.name;
end;
$$;

-- Add one by hand. Returns its id.
create or replace function public.admin_add_funding(
  p_name text, p_funder text, p_kind text, p_amount text, p_equity_free boolean, p_deadline date,
  p_region text, p_link text, p_eligibility text, p_fit text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text := public.funding_id(p_name);
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if exists (select 1 from public.funding_opportunities where id = v_id) then
    raise exception 'That one is already on the funding radar' using errcode = '23505';
  end if;
  insert into public.funding_opportunities (id, name, funder, kind, amount, equity_free, deadline, region, link, eligibility, fit, source)
  values (v_id, btrim(p_name), nullif(btrim(coalesce(p_funder, '')), ''), coalesce(nullif(p_kind, ''), 'grant'),
          nullif(btrim(coalesce(p_amount, '')), ''), p_equity_free, p_deadline, coalesce(nullif(p_region, ''), 'Africa'),
          nullif(btrim(coalesce(p_link, '')), ''), nullif(btrim(coalesce(p_eligibility, '')), ''),
          nullif(btrim(coalesce(p_fit, '')), ''), 'manual');
  return v_id;
end;
$$;

-- Move one along. The first time it's marked Applied keeps the date.
create or replace function public.admin_set_funding_status(p_id text, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.funding_opportunities
     set status = p_status,
         applied_on = case when p_status = 'applied' then coalesce(applied_on, (now() at time zone 'Africa/Lagos')::date) else applied_on end,
         updated_at = now()
   where id = p_id;
  if not found then
    raise exception 'Not found' using errcode = 'P0002';
  end if;
end;
$$;

-- Notes and the deadline, both editable on the page (deadlines often move)
create or replace function public.admin_set_funding_details(p_id text, p_notes text, p_deadline date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.funding_opportunities
     set notes = nullif(btrim(coalesce(p_notes, '')), ''),
         -- A new deadline gets its own week-before reminder
         reminded_on = case when p_deadline is distinct from deadline then null else reminded_on end,
         deadline = p_deadline,
         updated_at = now()
   where id = p_id;
  if not found then
    raise exception 'Not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.admin_delete_funding(p_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  delete from public.funding_opportunities where id = p_id;
end;
$$;

-- For the weekly search (cron secret): what's already listed, so it doesn't add
-- a programme again under a slightly different name. Names and dates only.
create or replace function public.funding_known(p_token text)
returns table (id text, name text, funder text, deadline date)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.radar_check_token(p_token);
  return query
    select f.id, f.name, f.funder, f.deadline from public.funding_opportunities f order by f.deadline nulls last, f.name;
end;
$$;

-- The weekly search adds its finds here (cron secret). One already listed is left
-- as it is, so its stage and notes are never overwritten. Past deadlines are skipped.
-- Returns the ones that were new, for the email to the founder.
create or replace function public.funding_import(p_token text, p_items jsonb)
returns setof public.funding_opportunities
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.radar_check_token(p_token);
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 100 then
    raise exception 'Send a list of up to 100 opportunities' using errcode = '22023';
  end if;

  return query
  with incoming as (
    select e, coalesce(nullif(e->>'id', ''), public.funding_id(e->>'name')) as id, nullif(e->>'deadline', '')::date as deadline
    from jsonb_array_elements(p_items) e
  )
  insert into public.funding_opportunities (id, name, funder, kind, amount, equity_free, deadline, region, link,
                                            eligibility, fit, prepare, source)
  select i.id, btrim(i.e->>'name'), nullif(i.e->>'funder', ''), coalesce(nullif(i.e->>'kind', ''), 'grant'),
         nullif(i.e->>'amount', ''), (i.e->'equity_free')::boolean, i.deadline,
         coalesce(nullif(i.e->>'region', ''), 'Africa'), nullif(i.e->>'link', ''), nullif(i.e->>'eligibility', ''),
         nullif(i.e->>'fit', ''), nullif(i.e->>'prepare', ''), 'weekly-search'
  from incoming i
  where i.deadline is null or i.deadline >= (now() at time zone 'Africa/Lagos')::date
  on conflict (id) do nothing
  returning *;
end;
$$;

-- For the daily job: deadlines 7 days away or less, not applied yet. Each is
-- claimed once, so the founder gets one reminder per deadline.
create or replace function public.claim_funding_reminders(p_token text)
returns setof public.funding_opportunities
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Africa/Lagos')::date;
begin
  perform public.radar_check_token(p_token);
  return query
  update public.funding_opportunities f
     set reminded_on = v_today
   where f.status in ('new', 'preparing')
     and f.reminded_on is null
     and f.deadline between v_today and v_today + 7
  returning f.*;
end;
$$;

revoke all on function public.funding_id(text) from public, anon, authenticated;
revoke all on function public.admin_list_funding() from public, anon;
revoke all on function public.admin_add_funding(text, text, text, text, boolean, date, text, text, text, text) from public, anon;
revoke all on function public.admin_set_funding_status(text, text) from public, anon;
revoke all on function public.admin_set_funding_details(text, text, date) from public, anon;
revoke all on function public.admin_delete_funding(text) from public, anon;
revoke all on function public.funding_known(text) from public, authenticated;
revoke all on function public.funding_import(text, jsonb) from public, authenticated;
revoke all on function public.claim_funding_reminders(text) from public, authenticated;
grant execute on function public.admin_list_funding() to authenticated;
grant execute on function public.admin_add_funding(text, text, text, text, boolean, date, text, text, text, text) to authenticated;
grant execute on function public.admin_set_funding_status(text, text) to authenticated;
grant execute on function public.admin_set_funding_details(text, text, date) to authenticated;
grant execute on function public.admin_delete_funding(text) to authenticated;
-- Called by the server with the cron secret, like the partner radar
grant execute on function public.funding_known(text) to anon;
grant execute on function public.funding_import(text, jsonb) to anon;
grant execute on function public.claim_funding_reminders(text) to anon;
