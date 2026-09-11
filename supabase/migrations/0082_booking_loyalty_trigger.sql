-- 0082 · The trigger that awards loyalty for a table booking
--
-- Found by diffing a full replay against the live database while
-- reconstructing 0020: the live project has this trigger and no migration
-- creates it. Stage 7 made it, along with the function it calls, and both went
-- straight to the database without a file.
--
-- It cannot go in 0020 with the rest of Stage 7, because the function it calls
-- is created by 0022, which fixed a bug in it with `create or replace` and so
-- happens to be the only file in the chain that defines it at all. A trigger
-- declared seven files before its function does not apply.
--
-- `create or replace trigger` rather than `create`: on the live project this
-- one already exists and must stay exactly as it is, and on a fresh build it
-- is the thing that has been missing. Either way the result is the same
-- trigger.
--
-- Without it, a database rebuilt from migrations takes bookings and never
-- awards a point for one, silently, because nothing errors.

create or replace trigger club_bookings_loyalty
  after insert or update of status on public.club_bookings
  for each row execute function public.club_bookings_award_loyalty();
