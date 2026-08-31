-- 0030 · What actually happened in the game
--
-- The app could record everything about a game except the result: who booked
-- the table, who they played, when, at what price. Legacy keeps the score on
-- the booking itself (bookedByScore / opponentScore, 16 of its 21 bookings
-- carry one), and so do we, because a scored game and a booked table are the
-- same event.
--
-- This is the missing piece under three features the client has asked about:
-- rivalry records, league standings a club can run, and the meta tracker.

alter table public.club_bookings
  add column if not exists booked_by_score numeric(6, 1),
  add column if not exists opponent_score  numeric(6, 1),
  -- Faction and detachment as written. Linking either side to a stored army
  -- list is the Army Builder, which is Milestone 3.
  add column if not exists booked_by_army  text not null default '',
  add column if not exists opponent_army   text not null default '',
  add column if not exists result_by       uuid references public.profiles (id) on delete set null,
  add column if not exists result_at       timestamptz;

-- A result is both scores or neither. Half a scoreline is not a result, and
-- would count as a loss for whoever was left null.
alter table public.club_bookings
  drop constraint if exists club_bookings_result_pair;
alter table public.club_bookings
  add constraint club_bookings_result_pair
  check ((booked_by_score is null) = (opponent_score is null));

-- The history query is "games this person played, newest first". Participants
-- already carries one row per person per booking, so the index goes there and
-- the scan is over one person's games rather than the club's.
create index if not exists club_booking_participants_history_idx
  on public.club_booking_participants (profile_id, session_date desc);

-- Head to head counts only scored games, so the partial index keeps unplayed
-- and unscored bookings out of it entirely.
create index if not exists club_bookings_scored_idx
  on public.club_bookings (id, session_date desc)
  where booked_by_score is not null;

/**
 * Record or correct the score on a booking.
 *
 * Either player may enter it, or the club. Both scores go in together, and
 * whoever submitted it is kept so a disagreement has a name against it.
 *
 * Scores are stored in the booking's own order — the person who booked, then
 * their opponent — never "mine" and "theirs", so the row means the same thing
 * whoever wrote it.
 */
create or replace function public.record_booking_result(
  p_booking bigint,
  p_booked_by_score numeric,
  p_opponent_score numeric,
  p_booked_by_army text default '',
  p_opponent_army text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.club_bookings%rowtype;
begin
  select * into target from public.club_bookings where id = p_booking;
  if not found then
    raise exception 'No such booking';
  end if;

  if target.status <> 'booked' then
    raise exception 'That booking was cancelled';
  end if;

  if not (
    auth.uid() in (target.booked_by, target.opponent_profile_id, target.accepted_by)
    or public.can_manage_club(target.club_id)
  ) then
    raise exception 'Only the players or the club can record that result';
  end if;

  if p_booked_by_score is null or p_opponent_score is null then
    raise exception 'Both scores are needed';
  end if;

  if p_booked_by_score < 0 or p_opponent_score < 0
     or p_booked_by_score > 9999 or p_opponent_score > 9999 then
    raise exception 'Those scores are out of range';
  end if;

  update public.club_bookings
     set booked_by_score = p_booked_by_score,
         opponent_score  = p_opponent_score,
         booked_by_army  = coalesce(p_booked_by_army, ''),
         opponent_army   = coalesce(p_opponent_army, ''),
         result_by       = auth.uid(),
         result_at       = now()
   where id = p_booking;
end;
$$;

/** Take a result back off a booking, for whoever put it there or the club. */
create or replace function public.clear_booking_result(p_booking bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.club_bookings%rowtype;
begin
  select * into target from public.club_bookings where id = p_booking;
  if not found then
    raise exception 'No such booking';
  end if;

  if not (
    auth.uid() in (target.booked_by, target.opponent_profile_id, target.accepted_by)
    or public.can_manage_club(target.club_id)
  ) then
    raise exception 'Only the players or the club can clear that result';
  end if;

  update public.club_bookings
     set booked_by_score = null, opponent_score = null,
         booked_by_army = '', opponent_army = '',
         result_by = null, result_at = null
   where id = p_booking;
end;
$$;

/**
 * One row per opponent this person has a scored game against.
 *
 * Aggregated in the database on purpose. Reading every game and counting them
 * in the app is fine at ten games and hopeless at ten thousand: this stays one
 * indexed scan of one person's bookings however many members the club has.
 *
 * Takes no argument and reads auth.uid(). A security definer function that
 * accepted an id would hand anybody anyone else's record.
 */
create or replace function public.head_to_head()
returns table (
  opponent_id uuid,
  opponent_name text,
  played integer,
  wins integer,
  draws integer,
  losses integer,
  last_played date
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (select auth.uid() as id),
  games as (
    select
      b.id,
      b.session_date,
      case when b.booked_by = me.id then b.opponent_profile_id else b.booked_by end
        as other_id,
      case when b.booked_by = me.id then b.booked_by_score else b.opponent_score end
        as my_score,
      case when b.booked_by = me.id then b.opponent_score else b.booked_by_score end
        as their_score
    from public.club_bookings b
    cross join me
    where b.booked_by_score is not null
      and b.status = 'booked'
      and me.id in (b.booked_by, b.opponent_profile_id)
  )
  select
    g.other_id,
    coalesce(nullif(btrim(p.full_name), ''), 'Club member'),
    count(*)::integer,
    count(*) filter (where g.my_score > g.their_score)::integer,
    count(*) filter (where g.my_score = g.their_score)::integer,
    count(*) filter (where g.my_score < g.their_score)::integer,
    max(g.session_date)
  from games g
  left join public.profiles p on p.id = g.other_id
  where g.other_id is not null
  group by g.other_id, p.full_name
  order by count(*) desc, max(g.session_date) desc;
$$;

revoke all on function public.record_booking_result(bigint, numeric, numeric, text, text)
  from public, anon;
grant execute on function public.record_booking_result(bigint, numeric, numeric, text, text)
  to authenticated;

revoke all on function public.clear_booking_result(bigint) from public, anon;
grant execute on function public.clear_booking_result(bigint) to authenticated;

-- Reads the caller's own games only, by construction.
revoke all on function public.head_to_head() from public, anon;
grant execute on function public.head_to_head() to authenticated;
