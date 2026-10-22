/**
 * An imported placing points at a list that was never in this database.
 *
 * `club_event_results.army` came across from legacy with legacy's own keys in
 * it, and `armyListId` is one of them: a sixteen-digit number of legacy's
 * making, nothing like the identity `army_lists` hands out. The reader was
 * fine with it (the units are in `armyListVersionSnapshot` beside it and are
 * real), but the placing editor seeded the hidden field from it, so saving a
 * placing nobody had touched came back **"Army list not found."** on a dialog
 * that was at that moment saying there was no list to name.
 *
 * The client reported it as *"this error was received when not selecting any
 * list and adding a placing"*, which is exactly what it is.
 *
 * The screen half is fixed in `usePlacingArmy`, which now seeds only an id it
 * could actually offer, so it can never post a dead one again. This is the
 * data half: without it every imported placing stays broken until somebody
 * opens it, hits the error once, and saves through it.
 *
 * **Only the pointer goes.** `armyListName` and `armyListVersionSnapshot` are
 * the evidence of what was played and they stay: the podium card and the list
 * dialog both read the snapshot, and dropping it would lose a list legacy
 * genuinely recorded to fix a link that never worked.
 */
update public.club_event_results r
   set army = r.army - 'armyListId'
 where r.army ? 'armyListId'
   and jsonb_typeof(r.army -> 'armyListId') = 'number'
   and not exists (
     select 1 from public.army_lists l
      where l.id = (r.army ->> 'armyListId')::bigint);

-- The same shape, one layer down. `game_result_armies.list_id` is a real
-- column with a foreign key, so it cannot hold a legacy id and needs nothing
-- here; this is only about the jsonb legacy wrote.
