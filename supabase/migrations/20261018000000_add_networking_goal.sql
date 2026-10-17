-- Allow the new "networking" goal. Values the app no longer offers stay valid
-- so existing rows keep passing the check (the app simply stops showing them).

alter table public.profiles drop constraint if exists profiles_networking_goals_check;

alter table public.profiles add constraint profiles_networking_goals_check check (
  networking_goals <@ array[
    'collaborators', 'mentors', 'jobs', 'networking',
    -- retired options, kept for existing rows
    'clients', 'mentees', 'hiring', 'investors', 'friends'
  ]::text[]
);
