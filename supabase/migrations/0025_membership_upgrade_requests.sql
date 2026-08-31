-- 0025 · A member asking to move up a tier
--
-- Legacy has no path for this at all: an owner changes somebody's tier and the
-- member finds out afterwards. The request lands on the membership row itself
-- rather than in a queue table, because there can only ever be one outstanding
-- request per membership and the owner reads it where they already act on it.
--
-- A function rather than an update policy: letting a member update their own
-- membership row would also let them write tier_key, which is the club's
-- decision, not theirs.

alter table public.club_memberships
  add column if not exists requested_tier_key text,
  add column if not exists tier_requested_at timestamptz;

create or replace function public.request_tier_upgrade(membership bigint, wanted text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.club_memberships%rowtype;
  stamp  timestamptz := now();
begin
  select * into target
    from public.club_memberships
   where id = membership
     and profile_id = auth.uid()
     and status = 'approved';

  if not found then
    raise exception 'No approved membership of yours with that id';
  end if;

  -- Asking for the tier you are already on is a no-op, not an error: the
  -- button can be pressed twice.
  if wanted is not null and wanted = target.tier_key then
    return null;
  end if;

  -- Only a tier this club actually sells. Nothing stops a crafted request
  -- otherwise, and the owner would see a tier that does not exist.
  if wanted is not null and not exists (
    select 1 from public.club_membership_tiers t
     where t.club_id = target.club_id and t.tier_key = wanted
  ) then
    raise exception 'That club does not offer that tier';
  end if;

  update public.club_memberships
     set requested_tier_key = wanted,
         tier_requested_at  = case when wanted is null then null else stamp end
   where id = membership;

  return case when wanted is null then null else stamp end;
end;
$$;

revoke all on function public.request_tier_upgrade(bigint, text) from public, anon;
grant execute on function public.request_tier_upgrade(bigint, text) to authenticated;
