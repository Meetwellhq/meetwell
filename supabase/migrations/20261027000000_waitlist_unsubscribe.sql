-- Occasional updates to the waiting list, with a one-click unsubscribe.
-- Each person gets a private, random token for their unsubscribe link.
-- Unsubscribing stops updates only; it doesn't remove anyone from the list,
-- and invites are still sent.

alter table public.waitlist
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid(),
  add column if not exists unsubscribed_at timestamptz;

create unique index if not exists waitlist_unsubscribe_token_idx on public.waitlist (unsubscribe_token);

-- Like join_waitlist(), but returns the new person's unsubscribe token (null if
-- the email was already on the list), so the welcome email can include the link.
-- join_waitlist() stays for compatibility.
create or replace function public.join_waitlist_with_token(p_email text, p_full_name text)
returns uuid
language sql
security definer
set search_path = ''
as $$
  insert into public.waitlist (email, full_name)
  values (lower(trim(p_email)), nullif(btrim(p_full_name), ''))
  on conflict (email) do nothing
  returning unsubscribe_token;
$$;

revoke all on function public.join_waitlist_with_token(text, text) from public;
grant execute on function public.join_waitlist_with_token(text, text) to anon, authenticated;

-- Called from the unsubscribe page. Returns true if the token matched.
create or replace function public.unsubscribe_waitlist(p_token uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with updated as (
    update public.waitlist
       set unsubscribed_at = coalesce(unsubscribed_at, now())
     where unsubscribe_token = p_token
    returning 1
  )
  select exists (select 1 from updated);
$$;

revoke all on function public.unsubscribe_waitlist(uuid) from public;
grant execute on function public.unsubscribe_waitlist(uuid) to anon, authenticated;
