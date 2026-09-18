import "server-only";

import * as repo from "@/repositories/eventPairings.repository";
import { findRosterPlayers } from "@/repositories/eventRoster.repository";
import type { PairingRound } from "@/types/eventEditor";
import { pairingRefusal } from "@/utils/event-refusals";
import type { Result } from "./eventEditor.service";

/**
 * Running the rounds.
 *
 * The case this is built for is the one the client described: twenty tables
 * and ten minutes between rounds. Everything here is a way of not typing forty
 * names, and the scores go in one screen rather than twenty dialogs.
 */

function refusalOf(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : String(error);
  const said = pairingRefusal(raw);
  if (said) return said;
  console.error("[pairings] unexpected refusal:", raw);
  return fallback;
}

export function getRounds(eventId: number): Promise<PairingRound[]> {
  return repo.findRounds(eventId);
}

/** Names off the roster, for the pickers and the draw. */
export async function getRoster(eventId: number) {
  return findRosterPlayers(eventId);
}

/** One table, added by hand or corrected. */
export async function saveMatch(
  eventId: number, round: number, label: string,
  match: {
    id: number | null; tableLabel: string;
    playerOne: string; playerOneId: string | null;
    playerTwo: string; playerTwoId: string | null;
    position: number;
  },
): Promise<Result> {
  if (!match.playerOne.trim()) return { ok: false, error: "A table needs at least one player." };
  if (match.playerTwo.trim()
      && match.playerOne.trim().toLowerCase() === match.playerTwo.trim().toLowerCase()) {
    return { ok: false, error: "That is the same player twice." };
  }

  const fields = {
    table_label: match.tableLabel.trim(),
    player_one: match.playerOne.trim(),
    player_one_id: match.playerOneId,
    player_two: match.playerTwo.trim(),
    player_two_id: match.playerTwo.trim() ? match.playerTwoId : null,
    position: match.position,
  };

  try {
    const pairingId = await repo.ensureRound(eventId, round, label);
    if (match.id) await repo.updateMatch(pairingId, match.id, fields);
    // Scores are set in their own form, so a new table starts with none.
    else await repo.insertMatches(pairingId, eventId,
      [{ ...fields, score_one: null, score_two: null }]);
    return { ok: true, id: pairingId, notice: "Saved." };
  } catch (error) {
    return { ok: false, error: refusalOf(error, "That did not save. Try again.") };
  }
}

/**
 * Every score in one round, in one save.
 *
 * A blank pair is a table nobody has finished, not a nil-nil. Clearing both
 * boxes is how a mis-entered result is taken back.
 */
export async function saveScores(
  pairingId: number,
  scores: { id: number; scoreOne: number | null; scoreTwo: number | null }[],
): Promise<Result> {
  try {
    for (const row of scores) {
      await repo.updateMatch(pairingId, row.id,
        { score_one: row.scoreOne, score_two: row.scoreTwo });
    }
    const entered = scores.filter((row) => row.scoreOne !== null || row.scoreTwo !== null).length;
    return { ok: true, notice: `${entered} ${entered === 1 ? "result" : "results"} saved.` };
  } catch (error) {
    return { ok: false, error: refusalOf(error, "That did not save. Try again.") };
  }
}

export async function removeMatch(pairingId: number, id: number): Promise<Result> {
  try {
    await repo.deleteMatches(pairingId, [id]);
    return { ok: true, notice: "Table removed." };
  } catch (error) {
    return { ok: false, error: refusalOf(error, "That did not delete. Try again.") };
  }
}

export async function publishRound(
  eventId: number, pairingId: number, published: boolean,
): Promise<Result> {
  try {
    await repo.setRoundPublished(eventId, pairingId, published);
    return { ok: true,
      notice: published ? "Members can see this draw." : "Hidden from members." };
  } catch (error) {
    return { ok: false, error: refusalOf(error, "That did not save. Try again.") };
  }
}

export async function removeRound(eventId: number, pairingId: number): Promise<Result> {
  try {
    await repo.deleteRound(eventId, pairingId);
    return { ok: true, notice: "Round removed." };
  } catch (error) {
    return { ok: false, error: refusalOf(error, "That did not delete. Try again.") };
  }
}
