-- 0141 · A recorded army carries how the game went
--
-- Stage 8 gave every result an army: one row per player per game, from four
-- sources, in `game_result_armies`. The tracker needs four more facts about
-- each of those rows and `M3-PLAN.md` proposes a second table to hold them
-- (`meta_result_rows`, fed by triggers from six sources). That table is the one
-- we already have. Two copies of one fact means two things to keep in step, and
-- the first time they disagreed the tracker is what would look broken.
--
-- So the columns land here instead:
--
--   outcome     won | lost | drew, for a game. Never for a podium or a league
--               standing: legacy is explicit that those strengthen faction and
--               unit signals and "do not create synthetic wins or losses".
--   confirmed   legacy counts a table booking only once the club has settled
--               it (club_store.py:25788). Everything else counts as recorded.
--   mission, deployment, terrain   the battle context, which lives on the
--               booking and is what the tracker's context view groups by.
--
-- The opponent's faction is deliberately NOT stored. It is the other side of
-- the same game, and `game_result_armies_one_side` makes reading it a
-- primary-key probe. Storing it would mean keeping two rows in step and
-- getting it wrong on whichever write lands first.
--
-- Kept in step by a trigger on `club_bookings` rather than by the writers,
-- for the reason 0136 gives about the standings: the result columns move from
-- the member's dialog, the club's score queue and anything added later, and a
-- sync that fires on one path is worse than none.
--
-- Checked on a throwaway Postgres built from every migration: recording a
-- result writes the outcome, settling it flips `confirmed` without touching
-- anything else, a draw reads as a draw, clearing a result takes the rows with
-- it, and a podium never gains an outcome.

alter table public.game_result_armies
  add column if not exists outcome    text not null default '',
  -- True for everything but an unsettled booking, which the trigger corrects.
  add column if not exists confirmed  boolean not null default true,
  add column if not exists mission    text not null default '',
  add column if not exists deployment text not null default '',
  add column if not exists terrain    text not null default '';

alter table public.game_result_armies
  drop constraint if exists game_result_armies_outcome;
alter table public.game_result_armies
  add constraint game_result_armies_outcome
  check (outcome in ('', 'won', 'lost', 'drew'));

-- Every rollup reads the same slice: confirmed rows that name a faction. The
-- partial index is what keeps that cheap at a million games.
create index if not exists game_result_armies_meta_idx
  on public.game_result_armies (played_on desc)
  where confirmed and faction_id <> '';
create index if not exists game_result_armies_meta_club_idx
  on public.game_result_armies (club_id, played_on desc)
  where confirmed and faction_id <> '';

/**
 * How one side of a booking went, from the pair of scores.
 *
 * Side `one` is whoever booked, which is the order the booking itself stores,
 * so this needs no turning round.
 */
create or replace function public.booking_outcome(
  p_side text, p_booked_by numeric, p_opponent numeric
) returns text
language sql immutable as $$
  select case
    when p_booked_by is null or p_opponent is null then ''
    when p_booked_by = p_opponent then 'drew'
    when (p_side = 'one') = (p_booked_by > p_opponent) then 'won'
    else 'lost'
  end;
$$;

/**
 * A booking's result, pushed onto the armies recorded against it.
 *
 * A trigger because the result moves from three screens already and will move
 * from more: the member's dialog, the club's score queue, and the admin
 * overruling either. `confirmed` is the one that matters most, because it is
 * what decides whether the tracker counts the game at all.
 */
create or replace function public.booking_result_meta()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.game_result_armies a
     set outcome = public.booking_outcome(a.side, new.booked_by_score, new.opponent_score),
         confirmed = (new.result_confirmation = 'admin-confirmed'),
         mission = coalesce(new.result_mission, ''),
         deployment = coalesce(new.result_deployment, ''),
         terrain = coalesce(new.result_terrain, ''),
         played_on = new.session_date
   where a.source_type = 'booking' and a.source_id = new.id;
  return new;
end $$;

drop trigger if exists booking_result_meta on public.club_bookings;
create trigger booking_result_meta
  after insert or update of booked_by_score, opponent_score, result_confirmation,
                            result_mission, result_deployment, result_terrain,
                            session_date
  on public.club_bookings
  for each row execute function public.booking_result_meta();

-- The rows stage 8 already wrote, brought up to date in one pass.
update public.game_result_armies a
   set outcome = public.booking_outcome(a.side, b.booked_by_score, b.opponent_score),
       confirmed = (b.result_confirmation = 'admin-confirmed'),
       mission = coalesce(b.result_mission, ''),
       deployment = coalesce(b.result_deployment, ''),
       terrain = coalesce(b.result_terrain, '')
  from public.club_bookings b
 where a.source_type = 'booking' and a.source_id = b.id;

revoke all on function public.booking_outcome(text, numeric, numeric) from public, anon;
revoke all on function public.booking_result_meta() from public, anon;
grant execute on function public.booking_outcome(text, numeric, numeric) to authenticated;
