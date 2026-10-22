"use client";

import { useState } from "react";
import { NO_ARMY, type ArmyNaming } from "@/components/results/ArmyPicker";
import { readDetachments } from "@/utils/result-army";
import type { MemberList } from "@/services/resultArmies.service";
import type { Linked } from "@/components/results/MemberCodeField";
import type { EventPlacing } from "@/types/event";
import { offerable } from "@/utils/placing-list";

/**
 * What one placing says about the army, while the dialog is open.
 *
 * Out of `PlacingEditor` because that file was over the size rule the moment
 * the list picker arrived, and because these four pieces of state move
 * together: opening a different placing has to reset all of them at once, and
 * naming a list writes three of them.
 *
 * The reset is derived during render rather than done in an effect. An effect
 * paints one frame of the previous winner's army, which is the thing
 * `useWhenChanged` exists to stop and is worse here than anywhere else: the
 * club is working down a printed results sheet and the wrong faction flashing
 * past is a faction somebody will believe they typed.
 */
export function usePlacingArmy(open: boolean, placing: EventPlacing | null,
                               lists: MemberList[],
                               accountNames: Record<string, string> = {}) {
  // The account this row points at, not just its id: the linked line names
  // them, and a code brings the name back with it.
  const [linked, setLinked] = useState<Linked | null>(null);
  const profileId = linked?.id ?? null;
  /**
   * What is in the Player box.
   *
   * Held here rather than left to the Autocomplete because a member code can
   * fill it: linking somebody from another club by their code knows their
   * name, and the box was staying empty, so the form refused to save with
   * "Please fill in this field" on a row the club had just linked correctly.
   * The client hit exactly that with a Joe Bloggs who is not a Didcot member.
   */
  const [playerName, setPlayerName] = useState("");
  const [army, setArmy] = useState<ArmyNaming>(NO_ARMY);
  const [listId, setListId] = useState<number | null>(null);
  const [seen, setSeen] = useState<number | string | null>(null);
  // Whose row this was the last time it settled, so changing the player can be
  // told apart from opening a different placing.
  const [seenProfile, setSeenProfile] = useState<string | null>(null);

  const key = placing?.id ?? "new";
  if (open && key !== seen) {
    setSeen(key);
    // Seeded to what `linked` is about to become, so the reset below does not
    // fire on the render that opens the dialog.
    setSeenProfile(placing?.profileId ?? null);
    // Read here rather than as a `useState` initialiser: an initialiser runs
    // on the first mount and never again, so this dialog carried the previous
    // winner's profile link onto the next row it opened.
    // Only the id is stored, so the name has to come from the account rather
    // than from `placing.name`, which is the club's own typing: echoing that
    // back would confirm a wrong link instead of exposing it (0177).
    setLinked(placing?.profileId
      ? { id: placing.profileId, name: accountNames[placing.profileId] }
      : null);
    setPlayerName(placing?.name ?? "");
    setArmy({
      factionId: placing?.army?.factionLabel ?? "",
      factionLabel: placing?.army?.factionLabel ?? "",
      // The list, or the one column that came before it: a placing saved
      // before 0217 carries `detachment` and no `detachments`.
      detachments: readDetachments(placing?.army ?? {}),
      disposition: placing?.army?.disposition ?? "",
    });
    // Only an id this dialog could have offered. A placing imported from
    // legacy carries legacy's OWN list id inside `club_event_results.army`
    // (`armyListId`, a sixteen-digit number of its own making), and nothing in
    // this database has ever had an `army_lists` row with that id. Seeding it
    // blind put it straight back on the hidden field, so saving a placing
    // nobody had touched came back "Army list not found." on a dialog saying
    // there was no list to name. The client reported it as "this error was
    // received when NOT selecting any list", which is exactly right.
    //
    // Dropping it means the field posts "" and the save clears the dead link,
    // so the row repairs itself rather than refusing for ever. A real link to
    // one of this player's lists is in `offerable` and is kept.
    setListId(offerable(lists, placing?.profileId ?? null, placing?.army?.list?.id ?? null));
  } else if (open && profileId !== seenProfile) {
    // The player moved, so the named list belonged to whoever is no longer on
    // this row. Without this the dialog kept it: the picker correctly stopped
    // offering it, because it filters to the named player's lists, and the
    // hidden field went on posting the id anyway. Saving then came back "That
    // list belongs to somebody else" about a list nobody had chosen, on a
    // dialog that was at that moment saying "They have not built an army list
    // at your club". The client hit exactly that.
    //
    // The faction is deliberately left alone, for the same reason clearing a
    // list leaves it alone: a club that typed it by hand should not lose it
    // because they corrected the name beside it.
    setSeenProfile(profileId);
    setListId(null);
  }

  // Only this player's. A club working down a results sheet must not be able
  // to hand somebody else's list to the winner, and the database refuses it
  // as well.
  const theirLists = lists.filter((list) => list.profileId === profileId);

  // A list already says which army it is, so naming one fills the cascade in
  // rather than asking for it twice. Clearing the list leaves the faction
  // alone: a club that typed it by hand should not lose it.
  const pickList = (list: MemberList | null) => {
    setListId(list?.id ?? null);
    if (!list) return;
    setArmy({
      factionId: list.factionId,
      factionLabel: list.faction,
      detachments: list.detachments,
      disposition: list.disposition,
    });
  };

  /**
   * Linked by code, which also answers who is in the Player box.
   *
   * The picker above fills the box itself when a member is chosen from the
   * roster; a code is the other way in and knew the name without saying so.
   */
  const linkByCode = (holder: Linked) => {
    setLinked(holder);
    if (holder.name) setPlayerName(holder.name);
  };

  return { linked, setLinked, linkByCode, profileId, army, setArmy, listId,
           pickList, theirLists, playerName, setPlayerName };
}
