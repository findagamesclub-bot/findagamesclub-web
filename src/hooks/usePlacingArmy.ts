"use client";

import { useState } from "react";
import { NO_ARMY, type ArmyNaming } from "@/components/results/ArmyPicker";
import type { MemberList } from "@/services/resultArmies.service";
import type { Linked } from "@/components/results/MemberCodeField";
import type { EventPlacing } from "@/types/event";

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
                               lists: MemberList[]) {
  // The account this row points at, not just its id: the linked line names
  // them, and a code brings the name back with it.
  const [linked, setLinked] = useState<Linked | null>(null);
  const profileId = linked?.id ?? null;
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
    // No name: all a saved row stores is the id, and the typed name is the
    // club's own wording rather than the account's.
    setLinked(placing?.profileId ? { id: placing.profileId } : null);
    setArmy({
      factionId: placing?.army?.factionLabel ?? "",
      factionLabel: placing?.army?.factionLabel ?? "",
      detachment: placing?.army?.detachment ?? "",
      disposition: placing?.army?.disposition ?? "",
    });
    setListId(placing?.army?.list?.id ?? null);
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
      detachment: list.detachment,
      disposition: list.disposition,
    });
  };

  return { linked, setLinked, profileId, army, setArmy, listId, pickList, theirLists };
}
