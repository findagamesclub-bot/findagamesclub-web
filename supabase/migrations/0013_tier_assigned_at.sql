-- Payment standing has to be scoped to the tier a member currently holds.
--
-- Legacy wiped tierPaidThroughAt whenever the tier or billing option changed
-- (club_store.py:11945), so credit never carried from one tier to another.
-- Deriving standing from the payments table alone cannot reproduce that: a
-- member who goes Basic -> Premium -> Basic would have their first Basic
-- payments come back to life. Recording when the current tier was assigned
-- lets the service ignore anything paid before it.

alter table public.club_memberships
  add column if not exists tier_assigned_at timestamptz;

comment on column public.club_memberships.tier_assigned_at is
  'When the current tier_key was set. Payments recorded before this do not count toward the current tier.';

-- Backfill: existing memberships have only ever held one tier, so everything
-- they have paid belongs to it.
update public.club_memberships
   set tier_assigned_at = coalesce(joined_at, created_at)
 where tier_assigned_at is null and tier_key is not null;

-- The owner sets this alongside tier_key, so it needs the same column grant.
grant update (tier_assigned_at) on public.club_memberships to authenticated;
