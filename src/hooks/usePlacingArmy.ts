"use client";

import { useState } from "react";
import { NO_ARMY, type ArmyNaming } from "@/components/results/ArmyPicker";
import type { MemberList } from "@/services/resultArmies.service";
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
  const [profileId, setProfileId] = useState<string | null>(null);
  const [army, setArmy] = useState<ArmyNaming>(NO_ARMY);
  const [listId, setListId] = useState<number | null>(null);
  const [seen, setSeen] = useState<number | string | null>(null);

  const key = placing?.id ?? "new";
  if (open && key !== seen) {
    setSeen(key);
    // Read here rather than as a `useState` initialiser: an initialiser runs
    // on the first mount and never again, so this dialog carried the previous
    // winner's profile link onto the next row it opened.
    setProfileId(placing?.profileId ?? null);
    setArmy({
      factionId: placing?.army?.factionLabel ?? "",
      factionLabel: placing?.army?.factionLabel ?? "",
      detachment: placing?.army?.detachment ?? "",
      disposition: placing?.army?.disposition ?? "",
    });
    setListId(placing?.army?.list?.id ?? null);
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

  return { profileId, setProfileId, army, setArmy, listId, pickList, theirLists };
}
