import type { MemberList } from "@/services/resultArmies.service";
import type { ArmyList } from "@/types/army";

/**
 * A member's own lists, in the shape every list picker on this site takes,
 * keyed by the club they were built at.
 *
 * The club's screens read `club_member_lists`, which is a manager's door and
 * answers for everybody on the roster. A member naming their own list on their
 * own result has no club role to lean on, so this comes from their own list
 * page's read instead and is narrowed here rather than in a second RPC.
 *
 * A util and not part of the service, so a client component can hold the
 * result without dragging `server-only` into the browser bundle. A type import
 * is erased, which is why `MemberList` can come from where it is declared.
 *
 * A list with no current version is left out: there is nothing to freeze
 * against the result, and `link_result_army_list` refuses it anyway.
 */
export function listsByClubSlug(lists: ArmyList[]): Record<string, MemberList[]> {
  const out: Record<string, MemberList[]> = {};

  for (const list of lists) {
    const current = list.current;
    if (!current || !list.clubSlug) continue;

    const held = out[list.clubSlug] ?? (out[list.clubSlug] = []);
    held.push({
      id: list.id,
      profileId: list.profileId,
      name: list.name,
      factionId: current.factionId,
      faction: current.factionLabel || current.factionId,
      detachment: current.detachments[0]?.detachment ?? "",
      disposition: current.detachments[0]?.disposition ?? "",
      points: current.totalPoints,
      version: current.versionNumber,
    });
  }

  return out;
}
