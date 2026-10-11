import "server-only";

import * as repo from "@/repositories/eventPairingArmies.repository";
import { setResultList } from "./resultArmies.service";
import { pairingRefusal } from "@/utils/event-refusals";
import { listFromSnapshot } from "@/utils/army-snapshot";
import type { Result } from "./eventEditor.service";
import type { ResultArmy } from "@/types/event";

/**
 * The armies on a draw, which is the half stage 8 built and never gave a
 * screen.
 *
 * `save_pairing_armies` has existed since 0136 with no caller at all: DEFERRED
 * recorded it as waiting for an interaction, because a round is twenty tables
 * and an army per side per table is not the one-dialog-per-round shape the
 * scores use. The client asked for it from the other end, so it is one dialog
 * per table, opened from the table's own row.
 *
 * Its own file rather than more of `eventPairings.service`, which was at the
 * size rule already and is about who plays whom.
 */

function refusalOf(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : String(error);
  const said = pairingRefusal(raw);
  if (said) return said;
  console.error("[pairing armies] unexpected refusal:", raw);
  return fallback;
}

/**
 * What was played on each table, keyed `<matchId>:<side>`.
 *
 * One read for every table on the event rather than one per round: a club
 * flicking between round tabs is reading the same page, and five rounds of
 * twenty tables is two hundred rows, which is one query and not two hundred.
 *
 * Empty rather than thrown on a failure. An army that will not load reads as a
 * table nobody has filled the army in on, which is the common case anyway, and
 * is a great deal better than a draw that will not draw between rounds.
 */
export type PairingArmy = {
  factionId: string;
  factionLabel: string;
  detachment: string;
  disposition: string;
  listId: number | null;
  listName: string;
};

/**
 * The same army, in the shape a reader's components already take.
 *
 * `PairingArmy` is the console's shape: it leads with `factionId` because the
 * dialog has to seed a picker with it. A reader never picks anything, and the
 * placing card and the round result have to agree about a list, so the public
 * side reuses `ResultArmy` rather than growing a second army type.
 */
export function readerArmy(row: {
  faction_label: string; detachment: string; disposition: string;
  list_id: number | null; list_name: string; snapshot: unknown;
  mvp_units: string[] | null;
}): ResultArmy | null {
  const faction = (row.faction_label ?? "").trim();
  const list = listFromSnapshot(row.snapshot, {
    id: row.list_id, name: row.list_name,
  });

  // A row with no faction and no list is a row `put_result_army` would have
  // deleted. Returning an empty army would draw an "army" line saying nothing.
  if (!faction && !list) return null;

  return {
    factionLabel: faction || null,
    detachment: (row.detachment ?? "").trim() || null,
    disposition: (row.disposition ?? "").trim() || null,
    mvpUnits: (row.mvp_units ?? []).filter(Boolean),
    list,
  };
}

/**
 * What each side of each table played, keyed `<matchId>:<side>`.
 *
 * The reader's half of `getRoundArmies`, which answers the console. One read
 * for the whole event, same as that one: five rounds of twenty tables is one
 * query, not two hundred.
 */
export async function getRoundArmiesForReaders(
  matchIds: number[],
): Promise<Record<string, ResultArmy>> {
  const rows = await repo.findPairingArmies(matchIds).catch(() => []);
  const out: Record<string, ResultArmy> = {};
  for (const row of rows) {
    const army = readerArmy(row);
    if (army) out[`${row.source_id}:${row.side}`] = army;
  }
  return out;
}

export async function getRoundArmies(
  matchIds: number[],
): Promise<Record<string, PairingArmy>> {
  const rows = await repo.findPairingArmies(matchIds).catch(() => []);
  const out: Record<string, PairingArmy> = {};
  for (const row of rows) {
    out[`${row.source_id}:${row.side}`] = {
      factionId: row.faction_id,
      factionLabel: row.faction_label,
      detachment: row.detachment,
      disposition: row.disposition,
      listId: row.list_id,
      listName: row.list_name,
    };
  }
  return out;
}

/**
 * Both armies on one table.
 *
 * Two writes, in this order and not the other: the list hangs off the army row
 * `save_pairing_armies` creates, so naming one before the faction exists has
 * nothing to attach to. A side left empty deletes its row, which also takes
 * the list with it, so there is nothing to clear by hand.
 */
export async function saveMatchArmies(
  matchId: number,
  armies: { one: Record<string, string>; two: Record<string, string> },
  lists: { one: number | null; two: number | null },
): Promise<Result> {
  try {
    await repo.savePairingArmies(matchId, armies);

    for (const side of ["one", "two"] as const) {
      // Nothing was named, so there is no row to hang a list off and none to
      // clear: `put_result_army` has already deleted it.
      if (!(armies[side].factionId ?? "").trim()) continue;
      const linked = await setResultList("event_pairing", matchId, side, lists[side]);
      // The armies are already saved, so this reports the list and nothing
      // else: saying "that did not save" about a faction that did is worse
      // than saying what actually went wrong.
      if (!linked.ok) {
        return { ok: false, error: linked.error ?? "That list did not save. Try again." };
      }
    }
    return { ok: true, notice: "Armies saved." };
  } catch (error) {
    return { ok: false, error: refusalOf(error, "That did not save. Try again.") };
  }
}
