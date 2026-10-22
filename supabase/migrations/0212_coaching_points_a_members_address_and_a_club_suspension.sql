/**
 * Three things a club could not do, and one it could not see.
 *
 *   20  Coaching earns no loyalty points, and the club's own editor does not
 *       offer the field. 0157 said so deliberately: legacy's four milestones
 *       are joining, a table, an event and merchandise, so coaching could
 *       SPEND points and never mint them. The client has now asked for the
 *       fifth, which is theirs to decide.
 *
 *   19  Nobody running a club can see a member's email address. Every other
 *       fact about a membership is on the screen and the one the club actually
 *       needs to contact somebody is not.
 *
 *   25  A club cannot take somebody off its own roster. `admin_suspend_account`
 *       bans the whole account across the site, which is a site admin's to
 *       press and far too much: *"This would not suspend the members account
 *       overall and membership to other clubs, but would suspend the member
 *       from being able to access the club in question."*
 */

-- ---------------------------------------------------------------------------
-- 20. A coaching booking earns points
-- ---------------------------------------------------------------------------

/**
 * 0022's table-booking award, for coaching.
 *
 * Copied rather than generalised: the two read different columns (a table
 * booking is `booked_by` and a coaching place is `profile_id`) and the shape
 * is twenty lines. A shared helper taking a column name would be harder to
 * read than the duplication.
 *
 * `source_key` is the idempotency key, so a club bouncing a booking between
 * states awards once. Cancelling claws back only what was actually given: a
 * place booked before the club switched the milestone on never earned
 * anything, and deducting for it would put the member below zero.
 */
create or replace function public.club_coaching_award_loyalty()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base    integer;
  v_club  bigint;
  key     text := 'coaching:' || new.id;
begin
  select s.club_id into v_club
    from public.club_coaching_slots s where s.id = new.slot_id;
  if v_club is null then return new; end if;

  select coalesce((s.milestones ->> 'coachingBooking')::integer, 0)
    into base from public.club_loyalty_settings s
   where s.club_id = v_club and s.enabled;

  if coalesce(base, 0) <= 0 then
    return new;
  end if;

  if tg_op = 'INSERT' and new.status = 'booked' then
    perform public.award_loyalty(
      v_club, new.profile_id, 'coaching-booking',
      'Coaching booked', base, key);

  elsif tg_op = 'UPDATE' and new.status <> 'booked' and old.status = 'booked' then
    if exists (
      select 1 from public.club_loyalty_transactions
       where club_id = v_club and source_key = key
    ) then
      insert into public.club_loyalty_transactions
        (club_id, profile_id, kind, category, description,
         available_delta, lifetime_delta, source_key)
      values
        (v_club, new.profile_id, 'cancelled', 'coaching-booking',
         'Coaching booking cancelled', -base, -base, key || '::cancelled')
      on conflict (club_id, source_key) do nothing;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists club_coaching_loyalty on public.club_coaching_bookings;
create trigger club_coaching_loyalty
  after insert or update of status on public.club_coaching_bookings
  for each row execute function public.club_coaching_award_loyalty();

-- ---------------------------------------------------------------------------
-- 19. The club can see a member's address
-- ---------------------------------------------------------------------------

/**
 * One address, for somebody who runs the club they are a member of.
 *
 * `profiles` carries no email: it lives in `auth.users`, which nothing but a
 * definer function or the service role can read. The membership emails have
 * gone out through the admin client since Stage 2 for exactly this reason, and
 * a screen cannot use that: `createAdminClient()` bypasses RLS entirely, so
 * letting a page reach it is how a public page ends up able to read
 * everything.
 *
 * So this is the narrow door: `members.manage` at a club the person is
 * actually a member of, one address at a time, and nothing else about them.
 * It returns null rather than raising for somebody who is not a member of that
 * club, because the caller is asking about a row on their own roster and an
 * exception would take a page down over a stale list.
 */
create or replace function public.club_member_email(p_club bigint, p_profile uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_email text;
begin
  if not (public.club_can(p_club, 'members.manage') or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  -- Only somebody on this club's roster. A club manager must not be able to
  -- walk the site's addresses by passing ids into this.
  if not exists (
    select 1 from public.club_memberships m
     where m.club_id = p_club and m.profile_id = p_profile) then
    return null;
  end if;

  select u.email into v_email from auth.users u where u.id = p_profile;
  return v_email;
end;
$$;

revoke all on function public.club_member_email(bigint, uuid) from public, anon;
grant execute on function public.club_member_email(bigint, uuid) to authenticated;

/**
 * What the console needs about a roster that a typed select cannot carry.
 *
 * Two facts and one round trip. The address is in `auth.users`, which only a
 * definer function reaches; `suspended_reason` is new in this migration and
 * `src/types/database.ts` has not been regenerated, so `check:columns` is
 * right to refuse a select naming it. Asking per dialog would be forty round
 * trips to fill a page somebody opens one of.
 *
 * Guarded identically to the single read and scoped to this club's own
 * roster, so it is the same door widened to the list the caller is already
 * allowed to read.
 */
create or replace function public.club_member_admin_facts(p_club bigint)
returns table (
  membership_id    bigint,
  profile_id       uuid,
  email            text,
  suspended_reason text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.club_can(p_club, 'members.manage') or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  return query
  select m.id, m.profile_id, u.email::text, coalesce(m.suspended_reason, '')
    from public.club_memberships m
    left join auth.users u on u.id = m.profile_id
   where m.club_id = p_club;
end;
$$;

revoke all on function public.club_member_admin_facts(bigint) from public, anon;
grant execute on function public.club_member_admin_facts(bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 25. A club can suspend somebody from its own roster
-- ---------------------------------------------------------------------------

alter table public.club_memberships
  drop constraint if exists club_memberships_status_check;
alter table public.club_memberships
  add constraint club_memberships_status_check
  check (status in ('pending', 'approved', 'cancelled', 'suspended'));

alter table public.club_memberships
  add column if not exists suspended_at     timestamptz,
  add column if not exists suspended_by     uuid references public.profiles (id) on delete set null,
  add column if not exists suspended_reason text not null default '';

comment on column public.club_memberships.suspended_reason is
  'Why the club took their access away. The member reads it, so it is the '
  'club''s words rather than an internal note.';

/**
 * A suspension blocks re-applying, where a cancellation does not.
 *
 * `club_memberships_one_live` covers pending and approved, which is right for
 * somebody who left of their own accord: 0012''s own comment says a cancelled
 * row must not block a fresh application. A suspension is the opposite. The
 * club decided; letting the member re-apply the next minute would make the
 * decision a formality.
 */
drop index if exists club_memberships_one_live;
create unique index club_memberships_one_live
  on public.club_memberships (club_id, profile_id)
  where status in ('pending', 'approved', 'suspended');

/**
 * Suspending, and lifting it.
 *
 * `is_club_member` and `club_role_of` both ask for `status = 'approved'`, so a
 * suspended member loses the board, the bookings and everything else behind
 * the club's door the moment this lands, without a single screen having to
 * know about it. That is the whole reason this is a status rather than a flag.
 *
 * **It never touches the account.** Suspending somebody at one club leaves
 * their account, their other clubs and their own data exactly as they were,
 * which is the line the client drew and the line `admin_suspend_account`
 * crosses on purpose.
 *
 * A function rather than a column grant: `status` is already grantable to the
 * member for leaving (0012 pins their own update to `cancelled`), so widening
 * the allowed values would let somebody suspend themselves, or worse, unsuspend
 * themselves. Same reason 0205 made the table payment a function.
 */
create or replace function public.set_membership_suspended(
  p_membership bigint,
  p_on         boolean,
  p_reason     text default ''
) returns table (
  membership_id bigint,
  status        text,
  suspended_at  timestamptz,
  suspended_reason text
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare v_club bigint; v_status text; v_profile uuid;
begin
  select m.club_id, m.status, m.profile_id
    into v_club, v_status, v_profile
    from public.club_memberships m where m.id = p_membership;
  if v_club is null then
    raise exception 'MEMBERSHIP_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  if not (public.club_can(v_club, 'members.manage') or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  -- Nobody on the club's own team, which is the conflict this must not
  -- create: a manager suspending the owner, or each other, is a club falling
  -- out through the software. Taking somebody off the team is the Team page's
  -- job and is a different decision.
  if exists (select 1 from public.club_team t
              where t.club_id = v_club and t.profile_id = v_profile) then
    raise exception 'MEMBER_ON_THE_TEAM' using errcode = 'check_violation';
  end if;

  if p_on then
    if v_status <> 'approved' then
      raise exception 'MEMBER_NOT_APPROVED' using errcode = 'check_violation';
    end if;
    return query
    update public.club_memberships m
       set status = 'suspended',
           suspended_at = now(),
           suspended_by = auth.uid(),
           suspended_reason = left(btrim(coalesce(p_reason, '')), 500)
     where m.id = p_membership
    returning m.id, m.status, m.suspended_at, m.suspended_reason;
  else
    if v_status <> 'suspended' then
      raise exception 'MEMBER_NOT_SUSPENDED' using errcode = 'check_violation';
    end if;
    -- Back to approved, and the reason goes with it: it described a state
    -- that is over, and leaving it behind would show on the next suspension.
    return query
    update public.club_memberships m
       set status = 'approved',
           suspended_at = null,
           suspended_by = null,
           suspended_reason = ''
     where m.id = p_membership
    returning m.id, m.status, m.suspended_at, m.suspended_reason;
  end if;
end;
$$;

revoke all on function public.set_membership_suspended(bigint, boolean, text)
  from public, anon;
grant execute on function public.set_membership_suspended(bigint, boolean, text)
  to authenticated;

/**
 * And the member is told, by trigger.
 *
 * Anything a club does to somebody gets told, and the undo is news as well,
 * which is the rule 0126 settled about badges. Being quietly unable to open a
 * club you are a member of is the worst version of this: the member would
 * assume the site was broken.
 *
 * Two kinds, because `notify_person` de-duplicates on
 * `(profile, kind, entity_type, entity_id)` while a notice is unread and both
 * carry the same membership. One kind would mean the lifting rewriting the
 * suspension in place. Seventh time this trap has come up.
 */
create or replace function public.club_membership_suspension_told()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_club text;
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status not in ('suspended', 'approved') then return new; end if;
  if old.status not in ('suspended', 'approved') then return new; end if;

  select c.name into v_club from public.clubs c where c.id = new.club_id;

  if new.status = 'suspended' then
    perform public.notify_person(
      new.profile_id, 'membership-suspended', 'membership', new.id::text,
      coalesce(v_club, 'A club') || ' has paused your membership',
      case when btrim(coalesce(new.suspended_reason, '')) <> ''
             then new.suspended_reason
             else 'Get in touch with the club if you think this is a mistake.' end);
  else
    perform public.notify_person(
      new.profile_id, 'membership-unsuspended', 'membership', new.id::text,
      coalesce(v_club, 'A club') || ' has put your membership back',
      'You can use everything at the club again.');
  end if;

  return new;
end;
$$;

drop trigger if exists club_memberships_suspension on public.club_memberships;
create trigger club_memberships_suspension
  after update of status on public.club_memberships
  for each row execute function public.club_membership_suspension_told();
