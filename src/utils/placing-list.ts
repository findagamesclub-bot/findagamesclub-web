import type { MemberList } from "@/services/resultArmies.service";

/**
 * The saved list id, but only when it is one the dialog can actually offer.
 *
 * A placing imported from legacy carries legacy's OWN list id inside
 * `club_event_results.army` (`armyListId`, a sixteen-digit number of its own
 * making), and nothing in this database has ever had an `army_lists` row with
 * that id. The editor seeded the hidden field from it, so saving a placing
 * nobody had touched came back **"Army list not found."** on a dialog that was
 * at that moment saying there was no list to name. The client reported it as
 * *"this error was received when not selecting any list"*, which is exactly
 * what it is.
 *
 * Anything that is not offerable is a link the club cannot see, cannot have
 * chosen and cannot re-affirm: a legacy id, a list somebody deleted, or one
 * belonging to whoever used to be on the row. Posting it back can only refuse.
 *
 * In `utils` rather than beside the hook because it is pure, and because a
 * rule that decides what a form posts is worth testing without React.
 */
export function offerable(
  lists: MemberList[], profileId: string | null, saved: number | null,
): number | null {
  if (saved === null || profileId === null) return null;
  return lists.some((list) => list.id === saved && list.profileId === profileId)
    ? saved
    : null;
}
