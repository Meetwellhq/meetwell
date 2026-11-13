-- Delete a shared code for good: it stops working, leaves the admin list, and
-- its "who joined with it" record goes too. People who joined keep their
-- accounts and cards. Only shared codes; personal invite codes stay.

create or replace function public.admin_delete_shared_code(p_code text)
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
  delete from public.access_codes where code = public.normalize_access_code(p_code) and shared;
end;
$$;
revoke all on function public.admin_delete_shared_code(text) from public;
revoke execute on function public.admin_delete_shared_code(text) from anon;
grant execute on function public.admin_delete_shared_code(text) to authenticated;
