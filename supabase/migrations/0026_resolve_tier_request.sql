-- 0026 · The club's side of a tier request
--
-- 0025 let a member ask. This lets the club clear the ask once it has decided,
-- either way. A function rather than a column grant: requested_tier_key is
-- validated on the way in by request_tier_upgrade, and granting the column to
-- authenticated would let a member write past that validation.

create or replace function public.resolve_tier_request(membership bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.club_memberships%rowtype;
begin
  select * into target from public.club_memberships where id = membership;
  if not found then
    raise exception 'No such membership';
  end if;

  if not public.can_manage_club(target.club_id) then
    raise exception 'That is not your club';
  end if;

  update public.club_memberships
     set requested_tier_key = null,
         tier_requested_at  = null
   where id = membership;
end;
$$;

revoke all on function public.resolve_tier_request(bigint) from public, anon;
grant execute on function public.resolve_tier_request(bigint) to authenticated;
