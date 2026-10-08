-- A placing that is removed takes what it played with it.
--
-- Found by driving 0163: a fourth place typed in while testing was removed
-- through the dialog, and the event's own analytics went from five armies to
-- four, which looks correct. It is correct, but only by accident:
-- `meta_event` joins `game_result_armies` to `club_event_results`, so a row
-- whose placing is gone stops being counted there. `meta_rows`, which every
-- site-wide rollup reads, joins nothing and goes on counting it.
--
-- So a club correcting a mistyped placing leaves a phantom army in the Meta
-- Tracker for ever. The outcome on a podium row is always '' (0141), so it
-- never moved a win rate; what it moved is representation, which is the figure
-- the tracker leads with.
--
-- This is stage 8's gap rather than 0163's: `put_result_army` keys on
-- `(source_type, source_id)` with no foreign key, because the column is
-- polymorphic, and `delete_event_placing` (0058) predates it. The competition
-- standing already handles DELETE for exactly this reason
-- (`competition_standing_army`, 0136); the podium is the one source that did
-- not.
--
-- Checked on a throwaway Postgres built from every migration: recording a
-- placing writes an army row, removing the placing takes it, and removing a
-- placing that never had an army is not an error.

create or replace function public.event_placing_army_gone()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.game_result_armies
   where source_type = 'event_podium' and source_id = old.id;
  return old;
end $$;

drop trigger if exists event_placing_army_gone on public.club_event_results;
create trigger event_placing_army_gone
  after delete on public.club_event_results
  for each row execute function public.event_placing_army_gone();

revoke all on function public.event_placing_army_gone() from public, anon;

-- The rows already orphaned, which is every placing anybody has ever removed.
-- An inner join is what names them: a podium army whose placing is not there.
delete from public.game_result_armies a
 where a.source_type = 'event_podium'
   and not exists (select 1 from public.club_event_results r where r.id = a.source_id);
