-- Admin view of one partner's people: everyone who joined through its link,
-- newest first, with whether they published a card and became a mentor. Admin
-- only (partners' own teams use partner_people, which shows public cards only).
create or replace function public.admin_partner_people(p_partner uuid)
returns table (
  joined_at timestamptz, email text, published boolean, mentor boolean,
  slug text, full_name text, avatar_url text, professional_title text, organization text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
    select s.created_at, u.email::text,
      coalesce(p.status = 'published', false),
      exists (select 1 from public.mentor_settings m where m.user_id = s.user_id and m.status = 'approved'),
      p.slug, p.full_name, p.avatar_url, p.professional_title, p.organization
    from public.partner_signups s
    join auth.users u on u.id = s.user_id
    left join public.profiles p on p.user_id = s.user_id
    where s.partner_id = p_partner
    order by s.created_at desc
    limit 1000;
end;
$$;
revoke all on function public.admin_partner_people(uuid) from public;
revoke execute on function public.admin_partner_people(uuid) from anon;
grant execute on function public.admin_partner_people(uuid) to authenticated;
