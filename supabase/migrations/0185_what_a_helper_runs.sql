-- 0185 · what a helper runs
--
-- The client, on club team access: a helper should be able to book games on
-- behalf of members, manage the noticeboard, and manage leagues and campaigns
-- as well as the results of league games.
--
-- Driving all three turned up that only ONE of them is a role gap.
--
--  a. BOOKING FOR SOMEBODY ELSE DOES NOT EXIST, AT ANY ROLE. A helper can
--     already book a table for themselves: `is_club_member` is true for
--     anybody with a team role (0067), and the bookings page hands the console
--     view to anybody with `bookings.manage`. What nothing on the site can do
--     is CREATE a booking in another person's name. `club_bookings_insert`
--     pins `booked_by = auth.uid()`, and the club's only control is
--     `edit_booking_details`, which moves an existing booking between people.
--     So this is the table twin of 0179, and it lands for every role at once.
--
--  b. THE NOTICEBOARD IS BEHIND THE LISTING. `club_announcements` is one of
--     the eight tables 0085 gates on `listing.edit` in a single loop, and the
--     only screen that writes it is a panel inside step four of the five-step
--     listing editor. `listing.edit` is the club's whole public face, its
--     reviews and its army settings, which is far too much to hand somebody
--     who is on the door on a Thursday. So the noticeboard gets a capability
--     of its own and comes out from behind the builder.
--
--  c. `competitions.manage` IS DECORATIVE. It has been in the capability
--     matrix since 0067 and NOTHING IN THE SCHEMA READS IT: every competition
--     policy is `can_manage_club(club_id)`, which is owner, manager or admin.
--     Adding it to the helper's array on its own would open the nav entry and
--     the page, and every save on that page would be refused by RLS. It has to
--     become real before the role can be widened.
--
--     The half that already worked is the giveaway: 0181's
--     `save_competition_round` and `save_competition_match_result` guard on
--     `results.manage`, which a helper holds. So a helper could already save
--     the GAMES inside a round and not the round, the standings or the
--     competition. "Leagues and campaigns, as well as results for league
--     games" is one job, and it was split down the middle.

-- --------------------------------------------------------- 1. the matrix
--
-- `noticeboard.manage` is new. A manager and an owner get it because they get
-- everything they had; a helper gets it and `competitions.manage` because that
-- is what this revision asks for.
--
-- A helper still does not get `listing.edit`, `members.manage`,
-- `analytics.view` or anything near the money. The line 0067 drew holds: the
-- night, and what the club says about it.

create or replace function public.club_role_capabilities(p_role text)
returns text[]
language sql
immutable
as $$
  select case p_role
    when 'owner' then array[
      'listing.edit', 'events.manage', 'members.manage', 'bookings.manage',
      'results.manage', 'board.moderate', 'noticeboard.manage', 'shop.manage',
      'coaching.manage', 'competitions.manage', 'messages.club',
      'analytics.view', 'team.manage', 'billing.manage', 'audit.view']
    when 'admin' then array[
      'listing.edit', 'events.manage', 'members.manage', 'bookings.manage',
      'results.manage', 'board.moderate', 'noticeboard.manage', 'shop.manage',
      'coaching.manage', 'competitions.manage', 'messages.club',
      'analytics.view', 'team.manage', 'billing.manage', 'audit.view']
    -- A manager runs the club day to day. Not the team, because inviting
    -- people is how a manager would make themselves an owner; not billing,
    -- because that is the owner's money.
    when 'manager' then array[
      'listing.edit', 'events.manage', 'members.manage', 'bookings.manage',
      'results.manage', 'board.moderate', 'noticeboard.manage', 'shop.manage',
      'coaching.manage', 'competitions.manage', 'messages.club',
      'analytics.view', 'audit.view']
    -- The night, and what the club says about it. A helper on the door moves a
    -- table, puts somebody on one, confirms a score, runs the league and pins
    -- a notice up. They still never see the roster's payment standing, the
    -- analytics or the listing.
    when 'helper' then array[
      'bookings.manage', 'results.manage', 'board.moderate',
      'noticeboard.manage', 'competitions.manage']
    else array[]::text[]
  end;
$$;

-- ----------------------------------------------------- 2. the noticeboard
--
-- One table out of 0085's loop. The other seven stay on `listing.edit`,
-- because a photo, a social link, a price row and the booking rules really are
-- the listing; a notice is this week's news.

drop policy if exists club_announcements_write on public.club_announcements;
create policy club_announcements_write on public.club_announcements
  for all to authenticated
  using (public.club_can(club_id, 'noticeboard.manage') or public.is_admin())
  with check (public.club_can(club_id, 'noticeboard.manage') or public.is_admin());

-- A notice carries the date it went up, and the whole point of the board is
-- that "a notice from Thursday and one from April are not the same news"
-- (ClubNoticeboard). The only writer was a delete-and-insert of every row, so
-- correcting a typo in Thursday's notice re-dated April's to today. Saving by
-- id is what keeps `created_at` meaning something, and one statement is what
-- stops a failure between the delete and the insert clearing the board.
create or replace function public.save_club_notices(
  p_club    bigint,
  p_notices jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows jsonb := coalesce(p_notices, '[]'::jsonb);
begin
  if not (public.club_can(p_club, 'noticeboard.manage') or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  with wanted as (
    select nullif(n ->> 'id', '')::bigint as id,
           left(btrim(coalesce(n ->> 'message', '')), 2000) as message,
           ord
      from jsonb_array_elements(v_rows) with ordinality as t(n, ord)
     where btrim(coalesce(n ->> 'message', '')) <> ''
  ),
  gone as (
    delete from public.club_announcements a
     where a.club_id = p_club
       and a.id not in (select w.id from wanted w where w.id is not null)
  ),
  changed as (
    update public.club_announcements a
       set message = w.message
      from wanted w
     where a.id = w.id and a.club_id = p_club and a.message is distinct from w.message
  )
  insert into public.club_announcements (club_id, message)
  select p_club, w.message from wanted w where w.id is null order by w.ord;
end;
$$;

revoke all on function public.save_club_notices(bigint, jsonb) from public, anon;
grant execute on function public.save_club_notices(bigint, jsonb) to authenticated;

-- ------------------------------------------------- 3. competitions, for real
--
-- A no-op for an owner, a manager and an admin, all of whom already hold
-- `competitions.manage`. What it changes is that the capability now decides,
-- so widening the role in part 1 actually reaches the rows.

do $$
declare
  spec text[][] := array[
    array['club_competitions', 'club_id'],
    array['club_competition_standings', 'competition_id'],
    array['club_competition_updates', 'competition_id'],
    array['club_competition_matches', 'update_id']
  ];
  i int;
begin
  for i in 1 .. array_length(spec, 1) loop
    execute format('drop policy if exists %I on public.%I',
                   spec[i][1] || '_manage', spec[i][1]);
  end loop;
end $$;

create policy club_competitions_manage on public.club_competitions
  for all to authenticated
  using (public.club_can(club_id, 'competitions.manage') or public.is_admin())
  with check (public.club_can(club_id, 'competitions.manage') or public.is_admin());

create policy club_competition_standings_manage on public.club_competition_standings
  for all to authenticated
  using (exists (select 1 from public.club_competitions c
                  where c.id = competition_id
                    and (public.club_can(c.club_id, 'competitions.manage')
                         or public.is_admin())))
  with check (exists (select 1 from public.club_competitions c
                       where c.id = competition_id
                         and (public.club_can(c.club_id, 'competitions.manage')
                              or public.is_admin())));

create policy club_competition_updates_manage on public.club_competition_updates
  for all to authenticated
  using (exists (select 1 from public.club_competitions c
                  where c.id = competition_id
                    and (public.club_can(c.club_id, 'competitions.manage')
                         or public.is_admin())))
  with check (exists (select 1 from public.club_competitions c
                       where c.id = competition_id
                         and (public.club_can(c.club_id, 'competitions.manage')
                              or public.is_admin())));

create policy club_competition_matches_manage on public.club_competition_matches
  for all to authenticated
  using (exists (select 1 from public.club_competition_updates u
                   join public.club_competitions c on c.id = u.competition_id
                  where u.id = update_id
                    and (public.club_can(c.club_id, 'competitions.manage')
                         or public.is_admin())))
  with check (exists (select 1 from public.club_competition_updates u
                        join public.club_competitions c on c.id = u.competition_id
                       where u.id = update_id
                         and (public.club_can(c.club_id, 'competitions.manage')
                              or public.is_admin())));

-- 0181 revoked write on `club_competition_matches` and routed it through
-- functions, so its policy governs nothing a member can reach. It is restated
-- anyway: a policy that disagrees with the three beside it is the one somebody
-- reads when the grants change back.

-- ------------------------------------- 4. the club puts somebody on a table
--
-- 0179's three decisions, and two of them are already true here for free:
-- `club_bookings_price()` reads `new.booked_by` and never `auth.uid()`, so the
-- tier, the discount and the frozen figures all land on the named member
-- without being passed in. The third is enforced below: points are set to zero
-- rather than left to a caller, because nobody at a door can consent to
-- spending somebody else's loyalty balance. They are still EARNED, by 0082's
-- trigger, so being booked in by the club is not a worse deal.
--
-- A table is a member benefit and is priced off a tier, which is why there is
-- no walk-in here and there was one for an event ticket. The screen says the
-- same thing in the same words.
--
-- Nothing else is re-implemented. The night, the weekday, the past-date rule,
-- the capacity, the seat index and the one-booking-per-person-per-date index
-- are all triggers and constraints on the row this inserts.

alter table public.club_bookings drop constraint if exists club_bookings_source_check;
alter table public.club_bookings add constraint club_bookings_source_check
  check (source in ('member', 'waitlist', 'looking-for-game', 'club'));

create or replace function public.club_add_table_booking(
  p_club          bigint,
  p_session       bigint,
  p_date          date,
  p_profile       uuid,
  p_game          text,
  p_notes         text default '',
  p_opponent      uuid default null,
  p_opponent_name text default ''
)
-- The row back rather than the id, so the club is told which table it is and
-- what the member owes without a second read. Every one of these figures is
-- written by the triggers, off the named member's tier.
returns table (
  booking_id    bigint,
  "table_index" smallint,
  total_price   numeric,
  price_currency text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking bigint;
begin
  if not (public.club_can(p_club, 'bookings.manage') or public.is_admin()) then
    raise exception 'NOT_PERMITTED' using errcode = 'insufficient_privilege';
  end if;

  if p_profile is null then
    raise exception 'BOOKING_NO_MEMBER' using errcode = 'check_violation';
  end if;

  if btrim(coalesce(p_game, '')) = '' then
    raise exception 'BOOKING_NO_GAME' using errcode = 'check_violation';
  end if;

  -- Approved members only, and the club's own team, who hold a table the same
  -- way a member does. Anyone else has no tier to price it from, which is the
  -- difference between this and an event ticket sold at a door.
  if not (exists (select 1 from public.club_memberships m
                   where m.club_id = p_club and m.profile_id = p_profile
                     and m.status = 'approved')
          or public.club_role_for(p_club, p_profile) is not null) then
    raise exception 'BOOKING_NOT_A_MEMBER' using errcode = 'check_violation';
  end if;

  insert into public.club_bookings
    (club_id, club_session_id, session_date, game_title, notes,
     booked_by, opponent_profile_id, opponent_name,
     source, loyalty_points_spent)
  values
    (p_club, p_session, p_date,
     left(btrim(p_game), 120), left(btrim(coalesce(p_notes, '')), 500),
     p_profile, p_opponent, left(btrim(coalesce(p_opponent_name, '')), 120),
     'club', 0)
  returning id into v_booking;

  return query
    select b.id, b.table_index, b.total_price, b.price_currency
      from public.club_bookings b where b.id = v_booking;
end;
$$;

revoke all on function public.club_add_table_booking(
  bigint, bigint, date, uuid, text, text, uuid, text) from public, anon;
grant execute on function public.club_add_table_booking(
  bigint, bigint, date, uuid, text, text, uuid, text) to authenticated;

-- The member has to be told, or the first they know about a table in their
-- name is the night it was for. 0047 told the named opponent and whoever came
-- off the waiting list, because those were the only two ways somebody ended up
-- on a table they had not asked for. This is the third.
create or replace function public.notify_on_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club  record;
  v_who   text;
  v_game  text := coalesce(nullif(btrim(new.game_title), ''), 'a game');
  v_night text;
begin
  if new.status <> 'booked' then
    return new;
  end if;

  select slug, name into v_club from public.clubs where id = new.club_id;
  v_night := to_char(new.session_date, 'FMDay FMDD Mon');

  if new.opponent_profile_id is not null
     and new.opponent_profile_id <> new.booked_by then
    select full_name into v_who from public.profiles where id = new.booked_by;
    perform public.notify_person(
      new.opponent_profile_id, 'booked_in',
      coalesce(nullif(btrim(v_who), ''), 'Someone') || ' booked you in for ' || v_game,
      coalesce(v_club.name, 'The club') || ', ' || v_night
        || coalesce(', ' || nullif(new.session_time, ''), ''),
      '/clubs/' || v_club.slug || '/bookings', 'booking', new.id::text);
  end if;

  if new.source = 'waitlist' then
    perform public.notify_person(
      new.booked_by, 'waitlist_promoted',
      'You have a table at ' || coalesce(v_club.name, 'the club'),
      v_night || ' for ' || v_game || '. It came off the waiting list, so it is yours.',
      '/account/bookings', 'booking', new.id::text);
  end if;

  -- Nobody is told about their own doing, which is the rule every other notice
  -- in this schema follows: a helper booking their own table is booking a
  -- table, not being given one.
  if new.source = 'club' and new.booked_by <> coalesce(auth.uid(), new.booked_by) then
    perform public.notify_person(
      new.booked_by, 'booked_by_club',
      coalesce(v_club.name, 'The club') || ' booked you a table',
      v_night || ' for ' || v_game
        || coalesce(', ' || nullif(new.session_time, ''), '')
        || '. The club put it on for you.',
      '/account/bookings', 'booking', new.id::text);
  end if;

  return new;
end;
$$;
