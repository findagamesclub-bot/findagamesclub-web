import "server-only";

import * as repo from "@/repositories/eventPairings.repository";
import { getRoster } from "./eventPairings.service";
import { pairingRefusal } from "@/utils/event-refusals";
import { drawRound } from "@/utils/pairings-draw";
import { parsePastedPairings } from "@/utils/pairings-paste";
import type { Result } from "./eventEditor.service";

/**
 * Filling a round without typing forty names.
 *
 * Two ways in, because organisers work two ways: a club night tournament draws
 * at random, and anybody running Swiss already has the pairings in a
 * spreadsheet. Both replace the round rather than adding to it, because
 * pressing the button twice means "do it again" and half a draw from each
 * attempt is the one outcome nobody wants.
 */

function refusalOf(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : String(error);
  const said = pairingRefusal(raw);
  if (said) return said;
  console.error("[pairings] unexpected refusal:", raw);
  return fallback;
}

/**
 * A random draw over whoever holds a place.
 *
 * Replaces the round rather than adding to it, because the button somebody
 * presses twice means "do it again", and half a draw from each attempt is the
 * one outcome nobody wants.
 */
export async function generateRound(
  eventId: number, round: number, label: string,
): Promise<Result> {
  const roster = await getRoster(eventId);
  if (roster.length < 2) {
    return { ok: false, error: "There are not enough people on the roster to pair yet." };
  }

  try {
    const pairingId = await repo.ensureRound(eventId, round, label);
    await repo.clearRound(pairingId);

    const drawn = drawRound(roster);
    await repo.insertMatches(pairingId, eventId, drawn.map((match, index) => ({
      table_label: match.table,
      player_one: match.playerOne.name,
      player_one_id: match.playerOne.profileId,
      player_two: match.playerTwo?.name ?? "",
      player_two_id: match.playerTwo?.profileId ?? null,
      score_one: null,
      score_two: null,
      position: index,
    })));

    const byes = drawn.filter((match) => !match.playerTwo).length;
    return { ok: true, id: pairingId,
      notice: byes ? `Drawn. ${drawn.length - byes} tables and one bye.`
                   : `Drawn. ${drawn.length} tables.` };
  } catch (error) {
    return { ok: false, error: refusalOf(error, "That did not draw. Try again.") };
  }
}

/**
 * A draw out of a spreadsheet.
 *
 * Names are matched back to the roster so a pasted round still links to member
 * accounts, the way legacy's `resolve_player` does on every read
 * (club_store.py:14819).
 */
export async function pasteRound(
  eventId: number, round: number, label: string, raw: string,
): Promise<Result> {
  const parsed = parsePastedPairings(raw).filter((match) => !match.problem);
  if (!parsed.length) {
    return { ok: false, error: "Nothing in that paste could be read as a table." };
  }

  const roster = await getRoster(eventId);
  const byName = new Map(roster.map((player) => [player.name.trim().toLowerCase(), player]));
  const idOf = (name: string) => byName.get(name.trim().toLowerCase())?.profileId ?? null;

  try {
    const pairingId = await repo.ensureRound(eventId, round, label);
    await repo.clearRound(pairingId);
    await repo.insertMatches(pairingId, eventId, parsed.map((match, index) => ({
      table_label: match.table,
      player_one: match.playerOne,
      player_one_id: idOf(match.playerOne),
      player_two: match.playerTwo,
      player_two_id: match.playerTwo ? idOf(match.playerTwo) : null,
      score_one: null,
      score_two: null,
      position: index,
    })));

    return { ok: true, id: pairingId,
      notice: `${parsed.length} ${parsed.length === 1 ? "table" : "tables"} saved.` };
  } catch (error) {
    return { ok: false, error: refusalOf(error, "That did not save. Try again.") };
  }
}
