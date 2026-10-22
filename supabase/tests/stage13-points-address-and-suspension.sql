-- 0212 · coaching points, a member's address, and a club-level suspension.
--
-- The assertion that matters is 9: suspending somebody at one club leaves
-- their membership of every other club exactly as it was. That is the line the
-- client drew, and it is the one a status change is easiest to get wrong on.
-- Run with scripts/pg-harness.sh psql -f this.
\i supabase/tests/stage8-seed.sql

create or replace function pg_temp.be(p uuid) returns void
language plpgsql as $$ begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

-- Read as postgres: a notification is readable only by the person it is for,
-- so counting somebody else's from an ordinary session reads zero whether one
-- was written or not. Third suite to need this.
-- The booking itself goes in as postgres. `club_coaching_bookings` is granted
-- by column (0157), so a plain insert from an ordinary session is refused and
-- the real path goes through the repository's own column list. What is under
-- test here is the TRIGGER, which fires whoever writes the row.
create or replace function pg_temp.book(p_slot bigint, p_who uuid) returns void
language sql security definer as $fn$
  insert into public.club_coaching_bookings (slot_id, profile_id, status)
  values (p_slot, p_who, 'booked') $fn$;

create or replace function pg_temp.give_up(p_slot bigint, p_who uuid) returns void
language sql security definer as $fn$
  update public.club_coaching_bookings set status = 'cancelled'
   where slot_id = p_slot and profile_id = p_who $fn$;

create or replace function pg_temp.notices(p_kind text) returns bigint
language sql security definer as $fn$
  select count(*) from public.notifications where kind = p_kind $fn$;

create or replace function pg_temp.seed() returns table (
  slot_id bigint, membership_id bigint, other_membership bigint, other_club bigint)
language plpgsql security definer as $fn$
declare v_club bigint; v_other bigint; v_slot bigint; v_mem bigint; v_mem2 bigint;
begin
  select id into v_club from public.clubs where slug = 'army-club';

  -- The club turns loyalty on, with a coaching milestone.
  insert into public.club_loyalty_settings (club_id, enabled, point_value, milestones)
  values (v_club, true, 0.05,
          '{"membershipApproved": 25, "gameBooking": 5, "coachingBooking": 7}'::jsonb)
  on conflict (club_id) do update
    set enabled = true, milestones = excluded.milestones;

  insert into public.club_coaching_slots
    (club_id, title, slot_date, start_time, capacity, status, coaching_type)
  values (v_club, 'List clinic', current_date + 14, '19:00', 4, 'open', 'group')
  returning id into v_slot;

  -- A second club the same person belongs to, which is what assertion 9 is
  -- about: suspending them at one must not reach the other.
  insert into public.clubs (slug, name, city, status, tables_available)
  values ('other-club', 'Other Club', 'Didcot', 'active', 4)
  returning id into v_other;
  insert into public.club_memberships (club_id, profile_id, status, joined_at, created_at)
  values (v_other, 'e0000000-0000-0000-0000-000000000003', 'approved', now(), now())
  returning id into v_mem2;

  select m.id into v_mem from public.club_memberships m
   where m.club_id = v_club and m.profile_id = 'e0000000-0000-0000-0000-000000000003';

  return query select v_slot, v_mem, v_mem2, v_other;
end $fn$;

create temp table fx as select * from pg_temp.seed();
grant select on fx to authenticated;

set local role authenticated;

do $$
declare w record; f record; v_club bigint; n bigint; v_email text; r record; v_err text;
begin
  select * into w from who;
  select * into f from fx;
  select id into v_club from c;

  -- 1 · A coaching booking earns the club's own figure.
  perform pg_temp.be(w.member);
  perform pg_temp.book(f.slot_id, w.member);

  select coalesce(sum(lifetime_delta), 0) into n
    from public.club_loyalty_transactions
   where club_id = v_club and category = 'coaching-booking';
  if n <> 7 then
    raise exception 'FAIL 1: a coaching booking earned %, expected 7', n;
  end if;

  -- 2 · Giving the place up claws it back, and both counters move: spending
  --     must not demote anybody, but points that were never really earned
  --     must not be left behind either.
  perform pg_temp.give_up(f.slot_id, w.member);
  select coalesce(sum(lifetime_delta), 0) into n
    from public.club_loyalty_transactions
   where club_id = v_club and category = 'coaching-booking';
  if n <> 0 then
    raise exception 'FAIL 2: after a cancellation the coaching points read %', n;
  end if;

  -- 3 · The address, for somebody who runs the club.
  perform pg_temp.be(w.owner);
  v_email := public.club_member_email(v_club, w.member);
  if v_email <> 'member8@example.com' then
    raise exception 'FAIL 3: the club read the address as "%"', v_email;
  end if;

  -- 4 · And only for somebody on its own roster, so a manager cannot walk the
  --     site's addresses by passing ids in.
  v_email := public.club_member_email(v_club, w.stranger);
  if v_email is not null then
    raise exception 'FAIL 4: a non-member''s address came back as "%"', v_email;
  end if;

  -- 5 · Not to anybody else at all.
  perform pg_temp.be(w.stranger);
  begin
    perform public.club_member_email(v_club, w.member);
    raise exception 'FAIL 5: a stranger read a member''s address';
  exception when insufficient_privilege then null;
  end;

  -- 6 · The club suspends them, and the door shuts. `is_club_member` is what
  --     every club-only read asks, so this is the whole feature in one line.
  perform pg_temp.be(w.owner);
  perform public.set_membership_suspended(f.membership_id, true, 'Repeatedly no-showed.');
  perform pg_temp.be(w.member);
  if public.is_club_member(v_club) then
    raise exception 'FAIL 6: a suspended member still counts as one';
  end if;

  -- 7 · They cannot lift it themselves, which a column grant would have let
  --     them do: `status` is already theirs to write for leaving.
  begin
    perform public.set_membership_suspended(f.membership_id, false, '');
    raise exception 'FAIL 7: the member lifted their own suspension';
  exception when insufficient_privilege then null;
  end;
  update public.club_memberships set status = 'approved' where id = f.membership_id;
  if public.is_club_member(v_club) then
    raise exception 'FAIL 7b: the member wrote their own status back to approved';
  end if;

  -- 8 · And cannot re-apply around it. A cancellation does not block a fresh
  --     application (0012) and a suspension must, or the club''s decision is a
  --     formality.
  begin
    insert into public.club_memberships (club_id, profile_id, status)
    values (v_club, w.member, 'pending');
    raise exception 'FAIL 8: a suspended member re-applied';
  exception when unique_violation then null;
  end;

  -- 9 · THE LINE. Their other club is untouched, and so is their account.
  perform pg_temp.be(w.member);
  if not public.is_club_member(f.other_club) then
    raise exception 'FAIL 9: suspending at one club reached another';
  end if;
  if not exists (select 1 from public.profiles
                  where id = w.member and is_active) then
    raise exception 'FAIL 9b: a club suspension deactivated the account';
  end if;

  -- 10 · The member is told, and told again when it is lifted. Two kinds, or
  --      the lifting rewrites the suspension in place while it is unread.
  if pg_temp.notices('membership-suspended') <> 1 then
    raise exception 'FAIL 10: % suspension notices', pg_temp.notices('membership-suspended');
  end if;
  perform pg_temp.be(w.owner);
  perform public.set_membership_suspended(f.membership_id, false, '');
  if pg_temp.notices('membership-unsuspended') <> 1 then
    raise exception 'FAIL 10b: % notices when it was lifted',
      pg_temp.notices('membership-unsuspended');
  end if;

  -- 11 · Lifting it puts them back and clears the reason, which described a
  --      state that is over.
  select * into r from public.club_memberships where id = f.membership_id;
  if r.status <> 'approved' or r.suspended_at is not null or r.suspended_reason <> '' then
    raise exception 'FAIL 11: after lifting, status % reason "%"',
      r.status, r.suspended_reason;
  end if;

  -- 12 · Nobody on the club's own team, which is the fallout this must not
  --      cause: a manager suspending the owner.
  begin
    perform public.set_membership_suspended(
      (select m.id from public.club_memberships m
        where m.club_id = v_club and m.profile_id = w.owner), true, 'No.');
    raise exception 'FAIL 12: the club suspended somebody on its own team';
  exception when check_violation then null;
  end;
end $$;

rollback;

\echo '0212 points, address and suspension: all pass'
