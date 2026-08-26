-- Membership: joining a club, owner approval, tiers, and the payment ledger.
--
-- Two orthogonal fields, matching the legacy state machine in club_store.py:
--   status    pending -> approved -> cancelled
--   tier_key  which tier they hold; null means the club's basic tier
-- A cancelled membership keeps its row and its payments, so history survives.

create table public.club_memberships (
  id           bigint generated always as identity primary key,
  club_id      bigint not null references public.clubs (id) on delete cascade,
  profile_id   uuid   not null references public.profiles (id) on delete cascade,

  status       text not null default 'pending'
                 check (status in ('pending', 'approved', 'cancelled')),

  -- Null is the club's basic tier. A paid tier names a row in
  -- club_membership_tiers, but is not a foreign key: tiers are keyed per club
  -- and an owner renaming a tier must not delete somebody's membership.
  tier_key     text,

  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz,
  reviewed_by  uuid references public.profiles (id) on delete set null,
  joined_at    timestamptz,
  -- Shown to the member when an owner turns them down. Legacy has no decline
  -- path at all, so this is new.
  decline_reason text,
  updated_at   timestamptz not null default now()
);

-- One live membership per person per club. The legacy app only blocked on
-- 'approved' or 'pending', so anyone who cancelled and re-applied ended up with
-- two rows and the status you got back depended on which one was read first.
-- A cancelled row does not block a fresh application.
create unique index club_memberships_one_live
  on public.club_memberships (club_id, profile_id)
  where status in ('pending', 'approved');

create index club_memberships_club_status_idx on public.club_memberships (club_id, status);
create index club_memberships_profile_idx     on public.club_memberships (profile_id);

-- Immutable ledger. `on delete restrict` on the membership: a cancelled
-- membership must not take its payment history with it.
create table public.club_membership_payments (
  id                    bigint generated always as identity primary key,
  membership_id         bigint not null references public.club_memberships (id) on delete restrict,
  club_id               bigint not null references public.clubs (id) on delete cascade,
  profile_id            uuid   not null references public.profiles (id) on delete cascade,

  tier_key              text,
  tier_label            text not null default '',
  billing_option_label  text not null default '',
  -- Free text on purpose. The source writes the same tier three ways ('30',
  -- '£150', 'GBP 30'), so this is recorded and displayed, never summed.
  price                 text not null default '',
  price_duration        text not null default '',

  period_start_at       timestamptz,
  period_end_at         timestamptz,
  note                  text,
  recorded_by           uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now()
);

create index club_membership_payments_membership_idx
  on public.club_membership_payments (membership_id, created_at desc);

-- Owner-or-admin, as one definition.
--
-- "Does this person own the club this row points at" needs a join, which a
-- policy cannot express on its own. security definer so the check can read
-- clubs and profiles regardless of the caller's own policies; the search_path
-- is pinned so the function cannot be redirected at a shadowed table.
create or replace function public.can_manage_club(target_club bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.clubs c
    where c.id = target_club and c.owner_id = (select auth.uid())
  ) or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

revoke all on function public.can_manage_club(bigint) from public, anon;
grant execute on function public.can_manage_club(bigint) to authenticated;

-- The predicate six other milestone 2 features are gated on: the roster,
-- discussion boards, direct messages, looking for games, bookings and
-- rivalries. Defined once, here, so it cannot drift between them.
create or replace function public.is_club_member(target_club bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_manage_club(target_club) or exists (
    select 1 from public.club_memberships m
    where m.club_id = target_club
      and m.profile_id = (select auth.uid())
      and m.status = 'approved'
  );
$$;

revoke all on function public.is_club_member(bigint) from public, anon;
grant execute on function public.is_club_member(bigint) to authenticated;

alter table public.club_memberships        enable row level security;
alter table public.club_membership_payments enable row level security;

-- You can always see your own membership. Approved members see the roster of a
-- club they belong to. Owners and admins see everything for their clubs,
-- including people still waiting.
create policy club_memberships_select
  on public.club_memberships for select
  to authenticated
  using (
    profile_id = (select auth.uid())
    or public.can_manage_club(club_id)
    or (status = 'approved' and public.is_club_member(club_id))
  );

-- Applying is the one thing a member may write directly, and only as
-- themselves, only as pending, and only on their own row.
create policy club_memberships_apply
  on public.club_memberships for insert
  to authenticated
  with check (profile_id = (select auth.uid()) and status = 'pending');

-- Approving, declining, assigning a tier and cancelling are owner actions.
create policy club_memberships_manage
  on public.club_memberships for update
  to authenticated
  using (public.can_manage_club(club_id))
  with check (public.can_manage_club(club_id));

-- Leaving a club is the member's own decision, so they may cancel themselves.
--
-- The `with check` pins the RESULT to 'cancelled'. Owners and members are both
-- the `authenticated` role, so column grants cannot tell them apart, and
-- without this clause the same policy would let anyone approve themselves or
-- award themselves the top tier. This is the third time that trap has come up
-- in this schema; RLS chooses rows, never columns.
create policy club_memberships_leave
  on public.club_memberships for update
  to authenticated
  using (profile_id = (select auth.uid()) and status in ('pending', 'approved'))
  with check (profile_id = (select auth.uid()) and status = 'cancelled');

create policy club_membership_payments_select
  on public.club_membership_payments for select
  to authenticated
  using (profile_id = (select auth.uid()) or public.can_manage_club(club_id));

create policy club_membership_payments_record
  on public.club_membership_payments for insert
  to authenticated
  with check (public.can_manage_club(club_id));

-- Data API access. Tables made in SQL are invisible to PostgREST without this.
grant select, insert on public.club_memberships to authenticated;
grant select, insert on public.club_membership_payments to authenticated;
grant usage, select on sequence club_memberships_id_seq to authenticated;
grant usage, select on sequence club_membership_payments_id_seq to authenticated;

-- RLS decides which rows you may touch, never which columns. Without this, the
-- "leave a club" policy above would let a member set their own status to
-- 'approved', or hand themselves the top tier.
revoke update on public.club_memberships from anon, authenticated;
grant update (status, tier_key, reviewed_at, reviewed_by, joined_at, decline_reason, updated_at)
  on public.club_memberships to authenticated;

-- A payment, once recorded, is a fact. No updates, no deletes.
revoke update, delete on public.club_membership_payments from anon, authenticated;
