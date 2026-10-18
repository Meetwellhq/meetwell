-- Supabase grants EXECUTE on new functions to the API roles by default, and
-- "revoke ... from public" doesn't remove those explicit grants. Lock down
-- functions that visitors should never call directly.

-- Run nightly by pg_cron (and by hand in the SQL Editor) only.
revoke execute on function public.purge_old_profile_events() from anon, authenticated;

-- Admin tools: logged-in users only (they still check is_admin() inside).
revoke execute on function public.is_admin() from anon;
revoke execute on function public.admin_list_waitlist() from anon;
revoke execute on function public.admin_invite(text) from anon;
