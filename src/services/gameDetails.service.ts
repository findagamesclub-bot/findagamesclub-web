import "server-only";

import { findGameArmies } from "@/repositories/resultArmies.repository";
import { readerArmy } from "./eventPairingArmies.service";
import { NO_GAME_DETAILS, readSource, storedSource,
  type GameDetails, type GameRef } from "@/utils/game-details";

/**
 * What was played in a list of games, whatever kind of game each one was.
 *
 * The rivalry tracker lists a club night and a league round side by side and
 * had no way into either: the client asked to open a result and see the army
 * list, the mission and the faction, which is what every other results screen
 * on the site already offers. `game_result_armies` has held all of it since
 * 0135; nothing on these two lists had ever read it.
 *
 * `competition_match` rather than `competition`: the second is a league
 * STANDING, which is a season's tally and not a game. The grudge reads name
 * their source `competition`, so the mapping happens in one place rather than
 * at three call sites that would each have to know.
 *
 * One read for a page of matches, and it catches: a game whose army will not
 * load reads as a game nobody recorded one for, which is most of them.
 */
export async function getGameDetails(refs: GameRef[]): Promise<GameDetails> {
  const wanted = refs.map((ref) => ({ ...ref, stored: storedSource(ref.source) }))
    .filter((ref) => ref.stored);
  if (!wanted.length) return NO_GAME_DETAILS;

  const rows = await findGameArmies(
    wanted.map((ref) => ref.stored),
    wanted.map((ref) => ref.id),
  ).catch(() => []);

  const armies: GameDetails["armies"] = {};
  const setup: GameDetails["setup"] = {};
  const players: GameDetails["players"] = {};

  for (const row of rows) {
    const read = readSource(row.source_type);
    if (!read) continue;
    const base = `${read}:${row.source_id}`;

    const army = readerArmy(row);
    if (army) armies[`${base}:${row.side}`] = army;
    players[`${base}:${row.side}`] = {
      id: row.profile_id, name: (row.player_name ?? "").trim(),
    };

    // Both sides carry the same mirrored setup, so whichever lands first wins
    // and the second is the same answer. Only written when there is one: an
    // empty mission is not a setup a club recorded.
    if (!setup[base] && (row.mission || row.deployment || row.terrain)) {
      setup[base] = {
        mission: row.mission, deployment: row.deployment, terrain: row.terrain,
      };
    }
  }

  return { armies, setup, players };
}
