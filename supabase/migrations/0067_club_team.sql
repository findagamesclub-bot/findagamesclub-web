-- 0067 · Club roles: owner, manager, helper
--
-- Until now a club had exactly one person who could do anything: the row in
-- clubs.owner_id. Every real club has more than one. Somebody runs the
-- Thursday door and approves the scores; somebody else keeps the listing and
-- the events up to date; only one person should be able to hand the club to
-- somebody else or see the money.
--
-- Three roles, and one function that answers "may this person do this here".
--
--   owner    everything, including the team and billing
--   manager  everything except the team and billing
--   helper   the night: bookings, results, and taking a post down
--
-- can_manage_club() keeps its name and its signature on purpose. Twenty-six
-- policies and twenty-six functions call it, and every one of them means
-- "somebody who runs this club", which now includes managers. Helpers are the
-- exception rather than the rule, so they are opted in one policy at a time
-- through club_can() (0069) rather than by widening this.
--
-- clubs.owner_id stays canonical. A trigger mirrors it into club_team, so the
-- two can never disagree and nothing that reads owner_id today has to change.

-- ---------------------------------------------------------------------------
-- 1. The team
-- ---------------------------------------------------------------------------

create table if not exists public.club_team (
  club_id    bigint not null references public.clubs (id) on delete cascade,
  profile_id uuid   not null references public.profiles (id) on delete cascade,
  role       text   not null check (role in ('owner', 'manager', 'helper')),
  added_by   uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (club_id, profile_id)
);

-- One owner, enforced rather than assumed. A second owner row is how "who gets
-- the billing emails" becomes an argument.
create unique index if not exists club_team_one_owner
  on public.club_team (club_id) where role = 'owner';

-- "Which clubs does this person run" is the query behind /my-clubs, the header
-- badge and the console, and it reads by person, not by club.
create index if not exists club_team_profile_idx
  on public.club_team (profile_id, club_id);

create table if not exists public.club_team_invites (
  id          bigint generated always as identity primary key,
  club_id     bigint not null references public.clubs (id) on delete cascade,
  -- Stored lowercased. An invite either names an address or an existing
  -- profile; the check keeps a row from naming neither.
  email       text,
  profile_id  uuid references public.profiles (id) on delete cascade,
  role        text not null check (role in ('manager', 'helper')),
  token       uuid not null default gen_random_uuid() unique,
  message     text not null default '',
  invited_by  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  declined_at timestamptz,
  revoked_at  timestamptz,
  constraint club_team_invites_addressed check (email is not null or profile_id is not null)
);

-- One open invite per person per club, so an owner clicking twice does not
-- send two links that both work.
create unique index if not exists club_team_invites_one_open
  on public.club_team_invites (club_id, coalesce(profile_id::text, lower(email)))
  where accepted_at is null and declined_at is null and revoked_at is null;

create index if not exists club_team_invites_club_idx
  on public.club_team_invites (club_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 2. What each role may do
-- ---------------------------------------------------------------------------

-- The matrix, as data rather than as fourteen scattered conditions. Mirrored
-- in src/utils/club-access.ts, which has a test asserting the same list, so
-- the two cannot drift without something going red.
create or replace function public.club_role_capabilities(p_role text)
returns text[]
language sql
immutable
as $$
  select case p_role
    when 'owner' then array[
      'listing.edit', 'events.manage', 'members.manage', 'bookings.manage',
      'results.manage', 'board.moderate', 'shop.manage', 'coaching.manage',
      'competitions.manage', 'messages.club', 'analytics.view',
      'team.manage', 'billing.manage', 'audit.view']
    when 'admin' then array[
      'listing.edit', 'events.manage', 'members.manage', 'bookings.manage',
      'results.manage', 'board.moderate', 'shop.manage', 'coaching.manage',
      'competitions.manage', 'messages.club', 'analytics.view',
      'team.manage', 'billing.manage', 'audit.view']
    -- A manager runs the club day to day. Not the team, because inviting
    -- people is how a manager would make themselves an owner; not billing,
    -- because that is the owner's money.
    when 'manager' then array[
      'listing.edit', 'events.manage', 'members.manage', 'bookings.manage',
      'results.manage', 'board.moderate', 'shop.manage', 'coaching.manage',
      'competitions.manage', 'messages.club', 'analytics.view', 'audit.view']
    -- The night, and nothing else. A helper on the door needs to move a table
    -- and confirm a score, and should never see the roster's payment standing.
    when 'helper' then array[
      'bookings.manage', 'results.manage', 'board.moderate']
    else array[]::text[]
  end;
$$;

-- Somebody else's role at a club. Separate from club_role_of because triggers
-- have to judge the person a row is about, not the person who wrote it — the
-- mistake 0016 had to inline its way around.
create or replace function public.club_role_for(target_club bigint, target_profile uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select t.role from public.club_team t
   where t.club_id = target_club and t.profile_id = target_profile;
$$;

-- The caller's role here. Admins hold every capability everywhere, so they
-- come back as their own role rather than being folded into 'owner': the
-- console shows what you are, and an admin is not the owner of the club.
create or replace function public.club_role_of(target_club bigint)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_admin() then 'admin'
    else public.club_role_for(target_club, (select auth.uid()))
  end;
$$;

create or replace function public.club_can(target_club bigint, capability text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select capability = any (public.club_role_capabilities(public.club_role_of(target_club)));
$$;

-- The subject-parameterised twin of can_manage_club.
create or replace function public.manages_club(target_club bigint, target_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.club_role_for(target_club, target_profile) in ('owner', 'manager'), false)
      or exists (select 1 from public.profiles p
                  where p.id = target_profile and p.role = 'admin');
$$;

-- ---------------------------------------------------------------------------
-- 3. The two predicates the rest of the schema is already built on
-- ---------------------------------------------------------------------------

-- Same name, same signature, wider meaning: owner or manager or admin. Every
-- existing policy that calls this now admits managers, which is the intent.
create or replace function public.can_manage_club(target_club bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- coalesce, because club_role_of() is null for somebody with no role here
  -- and `null in (...)` is null, not false. A policy reads that as a refusal,
  -- but `if not can_manage_club(...)` in plpgsql would not fire on it.
  select coalesce(public.club_role_of(target_club) in ('owner', 'manager', 'admin'), false);
$$;

-- A helper is not a member of the club in the joining sense, but they have to
-- read what they moderate: the roster, the board, the bookings. Any team role
-- counts here.
create or replace function public.is_club_member(target_club bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.club_role_of(target_club) is not null or exists (
    select 1 from public.club_memberships m
    where m.club_id = target_club
      and m.profile_id = (select auth.uid())
      and m.status = 'approved'
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. Keeping clubs.owner_id and club_team in step
-- ---------------------------------------------------------------------------

create or replace function public.mirror_club_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The outgoing owner keeps their access as a manager rather than losing the
  -- club outright. Handing over is not the same as being removed.
  if tg_op = 'UPDATE' and old.owner_id is not null and old.owner_id is distinct from new.owner_id then
    update public.club_team
       set role = 'manager', updated_at = now()
     where club_id = new.id and profile_id = old.owner_id and role = 'owner';
  end if;

  if new.owner_id is null then
    delete from public.club_team where club_id = new.id and role = 'owner';
    return new;
  end if;

  insert into public.club_team (club_id, profile_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (club_id, profile_id)
    do update set role = 'owner', updated_at = now();

  return new;
end;
$$;

drop trigger if exists clubs_mirror_owner on public.clubs;
create trigger clubs_mirror_owner
  after insert or update of owner_id on public.clubs
  for each row execute function public.mirror_club_owner();

-- Backfill. Every club that has an owner gets its owner row.
insert into public.club_team (club_id, profile_id, role)
select c.id, c.owner_id, 'owner'
  from public.clubs c
 where c.owner_id is not null
on conflict (club_id, profile_id) do nothing;

-- ---------------------------------------------------------------------------
-- 5. Who may read the team
-- ---------------------------------------------------------------------------

alter table public.club_team enable row level security;
alter table public.club_team_invites enable row level security;

-- Your own rows, so /my-clubs can list what you run, plus the whole team of
-- any club you manage.
drop policy if exists club_team_select on public.club_team;
create policy club_team_select on public.club_team
  for select to authenticated
  using (profile_id = (select auth.uid()) or public.can_manage_club(club_id));

-- Managers see the club's invites; the person invited sees their own, which is
-- what makes the accept page work before they are on the team.
drop policy if exists club_team_invites_select on public.club_team_invites;
create policy club_team_invites_select on public.club_team_invites
  for select to authenticated
  using (
    public.can_manage_club(club_id)
    or profile_id = (select auth.uid())
    or (email is not null and email = lower(coalesce((select auth.jwt() ->> 'email'), '')))
  );

-- Every write goes through a function below. Supabase grants authenticated
-- insert, update and delete on the whole of every new table in public, so the
-- revoke has to come first or the policies above are decoration.
revoke insert, update, delete on public.club_team from authenticated, anon;
revoke insert, update, delete on public.club_team_invites from authenticated, anon;
grant select on public.club_team, public.club_team_invites to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Changing the team
-- ---------------------------------------------------------------------------

create or replace function public.invite_club_team_member(
  p_club bigint,
  p_role text,
  p_email text default null,
  p_profile uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := (select auth.uid());
  clean_email text := nullif(btrim(lower(coalesce(p_email, ''))), '');
  target uuid := p_profile;
  new_id bigint;
  new_token uuid;
begin
  if actor is null then
    raise exception 'NOT_SIGNED_IN' using errcode = 'insufficient_privilege';
  end if;
  if not public.club_can(p_club, 'team.manage') then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;
  if p_role not in ('manager', 'helper') then
    raise exception 'TEAM_BAD_ROLE' using errcode = 'check_violation';
  end if;
  if target is null and clean_email is null then
    raise exception 'TEAM_NO_ADDRESSEE' using errcode = 'check_violation';
  end if;

  -- An address that already has an account is invited as that account, so
  -- accepting does not depend on them signing in with the same address twice.
  if target is null then
    select u.id into target from auth.users u where lower(u.email) = clean_email;
  end if;

  if target is not null and exists (
    select 1 from public.club_team where club_id = p_club and profile_id = target
  ) then
    raise exception 'TEAM_ALREADY_ON' using errcode = 'unique_violation';
  end if;

  insert into public.club_team_invites (club_id, email, profile_id, role, invited_by)
  values (p_club, clean_email, target, p_role, actor)
  returning id, token into new_id, new_token;

  if target is not null then
    perform public.notify_person(
      target, 'team_invite',
      'You have been invited to help run a club',
      'Open the invitation to accept or decline.',
      '/team/invites/' || new_token::text, 'club', p_club::text);
  end if;

  return new_id;
end;
$$;

create or replace function public.respond_club_team_invite(p_token uuid, p_accept boolean)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := (select auth.uid());
  actor_email text := lower(coalesce((select auth.jwt() ->> 'email'), ''));
  inv public.club_team_invites;
begin
  if actor is null then
    raise exception 'NOT_SIGNED_IN' using errcode = 'insufficient_privilege';
  end if;

  select * into inv from public.club_team_invites
   where token = p_token
     and accepted_at is null and declined_at is null and revoked_at is null
   for update;

  if inv.id is null then
    raise exception 'INVITE_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  if inv.expires_at < now() then
    raise exception 'INVITE_EXPIRED' using errcode = 'check_violation';
  end if;
  -- The link is not the authorisation. It has to be the person it was sent to.
  if not (inv.profile_id = actor or (inv.email is not null and inv.email = actor_email)) then
    raise exception 'INVITE_NOT_YOURS' using errcode = 'insufficient_privilege';
  end if;

  if p_accept then
    insert into public.club_team (club_id, profile_id, role, added_by)
    values (inv.club_id, actor, inv.role, inv.invited_by)
    on conflict (club_id, profile_id) do update
      set role = excluded.role, updated_at = now();

    update public.club_team_invites
       set accepted_at = now(), accepted_by = actor where id = inv.id;

    perform public.notify_person(
      inv.invited_by, 'team_invite',
      'Your invitation was accepted',
      '', '/clubs', 'club', inv.club_id::text);
  else
    update public.club_team_invites set declined_at = now() where id = inv.id;
    perform public.notify_person(
      inv.invited_by, 'team_invite',
      'Your invitation was declined',
      '', '/clubs', 'club', inv.club_id::text);
  end if;

  return inv.club_id;
end;
$$;

create or replace function public.revoke_club_team_invite(p_invite bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  row_club bigint;
begin
  select club_id into row_club from public.club_team_invites
   where id = p_invite
     and accepted_at is null and declined_at is null and revoked_at is null
   for update;

  if row_club is null then
    raise exception 'INVITE_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  if not public.club_can(row_club, 'team.manage') then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  update public.club_team_invites set revoked_at = now() where id = p_invite;
  return row_club;
end;
$$;

create or replace function public.set_club_team_role(p_club bigint, p_profile uuid, p_role text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_role_name text;
begin
  if not public.club_can(p_club, 'team.manage') then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;
  if p_role not in ('manager', 'helper') then
    raise exception 'TEAM_BAD_ROLE' using errcode = 'check_violation';
  end if;

  select role into current_role_name from public.club_team
   where club_id = p_club and profile_id = p_profile for update;

  if current_role_name is null then
    raise exception 'TEAM_NOT_ON' using errcode = 'no_data_found';
  end if;
  -- Ownership moves through transfer_club_ownership, which asks for the club's
  -- name to be typed. Demoting the owner from a role dropdown is not that.
  if current_role_name = 'owner' then
    raise exception 'TEAM_IS_OWNER' using errcode = 'check_violation';
  end if;

  update public.club_team set role = p_role, updated_at = now()
   where club_id = p_club and profile_id = p_profile;

  perform public.notify_person(
    p_profile, 'team_role', 'Your role at a club changed',
    'You are now a ' || p_role || '.', '/clubs', 'club', p_club::text);

  return p_role;
end;
$$;

create or replace function public.remove_club_team_member(p_club bigint, p_profile uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_role_name text;
begin
  -- Standing down yourself needs no permission; removing anybody else does.
  if p_profile <> (select auth.uid()) and not public.club_can(p_club, 'team.manage') then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  select role into current_role_name from public.club_team
   where club_id = p_club and profile_id = p_profile for update;

  if current_role_name is null then
    raise exception 'TEAM_NOT_ON' using errcode = 'no_data_found';
  end if;
  if current_role_name = 'owner' then
    raise exception 'TEAM_IS_OWNER' using errcode = 'check_violation';
  end if;

  delete from public.club_team where club_id = p_club and profile_id = p_profile;
  return p_profile;
end;
$$;

create or replace function public.transfer_club_ownership(p_club bigint, p_to uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := (select auth.uid());
  from_owner uuid;
begin
  select owner_id into from_owner from public.clubs where id = p_club for update;

  -- A manager may not hand the club on. Only the person who holds it, or an
  -- admin sorting out a club nobody can reach.
  if not (from_owner = actor or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;
  if p_to is null then
    raise exception 'TRANSFER_NO_TARGET' using errcode = 'check_violation';
  end if;
  if p_to = from_owner then
    raise exception 'TRANSFER_SAME_PERSON' using errcode = 'check_violation';
  end if;

  -- Somebody already connected to the club, so ownership cannot be posted to a
  -- stranger's id typed into a form.
  if not exists (select 1 from public.club_team where club_id = p_club and profile_id = p_to)
     and not exists (select 1 from public.club_memberships
                      where club_id = p_club and profile_id = p_to and status = 'approved') then
    raise exception 'TRANSFER_NOT_CONNECTED' using errcode = 'check_violation';
  end if;

  update public.clubs set owner_id = p_to where id = p_club;

  perform public.notify_person(
    p_to, 'team_role', 'You now own a club',
    'Billing and the team are yours from now on.', '/clubs', 'club', p_club::text);
  if from_owner is not null then
    perform public.notify_person(
      from_owner, 'team_role', 'You handed a club on',
      'You are a manager there now.', '/clubs', 'club', p_club::text);
  end if;

  return p_to;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Two callers that judged ownership by hand
-- ---------------------------------------------------------------------------

-- 0016 inlined the owner check because can_manage_club() reads auth.uid() and
-- this has to judge the person the booking is in the name of. manages_club()
-- is that function, so the copy can go.
create or replace function public.club_event_booking_items_eligible()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  club     bigint;
  buyer    uuid;
  audience text;
  needed   text;
  manager  boolean;
  held     text;
  need_pos smallint;
  held_pos smallint;
begin
  select coalesce(nullif(btrim(lower(t.audience)), ''), 'all'),
         nullif(btrim(t.minimum_tier_key), '')
    into audience, needed
    from public.club_event_ticket_types t
   where t.id = new.ticket_type_id;

  if audience = 'all' and needed is null then
    return new;
  end if;

  select b.club_id, b.profile_id into club, buyer
    from public.club_event_bookings b where b.id = new.booking_id;

  manager := public.manages_club(club, buyer);

  if manager then
    return new;
  end if;

  if buyer is null then
    raise exception 'TICKET_NOT_ELIGIBLE' using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1 from public.club_memberships m
     where m.club_id = club and m.profile_id = buyer and m.status = 'approved'
  ) then
    raise exception 'TICKET_NOT_ELIGIBLE' using errcode = 'insufficient_privilege';
  end if;

  if needed is null then
    return new;
  end if;

  select m.tier_key into held
    from public.club_memberships m
   where m.club_id = club and m.profile_id = buyer and m.status = 'approved';

  select t.position into need_pos
    from public.club_membership_tiers t
   where t.club_id = club and t.tier_key = needed;

  select t.position into held_pos
    from public.club_membership_tiers t
   where t.club_id = club and t.tier_key = held;

  if need_pos is null then
    return new;
  end if;

  if coalesce(held_pos, -1) < need_pos then
    raise exception 'TICKET_NOT_ELIGIBLE' using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

-- Anybody on the team sees every category, helpers included. A tier ladder is
-- for members; somebody moderating the board is not standing on it.
create or replace function public.can_use_discussion_category(target_club bigint, category text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  wanted   text := btrim(lower(coalesce(category, '')));
  need_pos smallint;
  held_pos smallint;
begin
  if public.club_role_of(target_club) is not null then
    return true;
  end if;
  if not public.is_club_member(target_club) then
    return false;
  end if;

  select max(t.position) into need_pos
    from public.club_membership_tiers t
   cross join lateral jsonb_array_elements_text(
     case jsonb_typeof(t.benefits -> 'privateDiscussionCategories')
       when 'array' then t.benefits -> 'privateDiscussionCategories'
       else '[]'::jsonb
     end
   ) as reserved(label)
   where t.club_id = target_club
     and btrim(lower(reserved.label)) = wanted;

  if need_pos is null then
    return true;
  end if;

  select t.position into held_pos
    from public.club_memberships m
    join public.club_membership_tiers t
      on t.club_id = m.club_id and t.tier_key = m.tier_key
   where m.club_id = target_club
     and m.profile_id = (select auth.uid())
     and m.status = 'approved';

  return coalesce(held_pos, -1) >= need_pos;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Grants
-- ---------------------------------------------------------------------------

revoke all on function public.club_role_capabilities(text) from public, anon;
revoke all on function public.club_role_for(bigint, uuid) from public, anon;
revoke all on function public.club_role_of(bigint) from public, anon;
revoke all on function public.club_can(bigint, text) from public, anon;
revoke all on function public.manages_club(bigint, uuid) from public, anon;
revoke all on function public.invite_club_team_member(bigint, text, text, uuid) from public, anon;
revoke all on function public.respond_club_team_invite(uuid, boolean) from public, anon;
revoke all on function public.revoke_club_team_invite(bigint) from public, anon;
revoke all on function public.set_club_team_role(bigint, uuid, text) from public, anon;
revoke all on function public.remove_club_team_member(bigint, uuid) from public, anon;
revoke all on function public.transfer_club_ownership(bigint, uuid) from public, anon;

grant execute on function public.club_role_capabilities(text) to authenticated;
grant execute on function public.club_role_for(bigint, uuid) to authenticated;
grant execute on function public.club_role_of(bigint) to authenticated;
grant execute on function public.club_can(bigint, text) to authenticated;
grant execute on function public.manages_club(bigint, uuid) to authenticated;
grant execute on function public.invite_club_team_member(bigint, text, text, uuid) to authenticated;
grant execute on function public.respond_club_team_invite(uuid, boolean) to authenticated;
grant execute on function public.revoke_club_team_invite(bigint) to authenticated;
grant execute on function public.set_club_team_role(bigint, uuid, text) to authenticated;
grant execute on function public.remove_club_team_member(bigint, uuid) to authenticated;
grant execute on function public.transfer_club_ownership(bigint, uuid) to authenticated;

-- The whole-table grant Supabase hands out has to be gone, or the column lists
-- everywhere else in this schema are decoration. Both tables are function-only.
do $$
declare bad text;
begin
  select string_agg(table_name, ', ') into bad
    from information_schema.role_table_grants
   where table_schema = 'public'
     and table_name in ('club_team', 'club_team_invites')
     and grantee in ('authenticated', 'anon')
     and privilege_type in ('INSERT', 'UPDATE', 'DELETE');
  if bad is not null then
    raise exception 'whole-table grant still present on %', bad;
  end if;
end $$;
