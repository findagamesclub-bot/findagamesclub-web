import "server-only";

import * as repo from "@/repositories/eventTeams.repository";
import * as pairings from "@/repositories/eventPairings.repository";
import { teamRefusal } from "@/utils/event-refusals";
import { drawTeamRound, teamDrawSummary, type DrawTeam } from "@/utils/team-draw";
import type { EventTeam, TeamFixture } from "@/types/eventTeams";
import type { Result } from "./eventEditor.service";

/**
 * A team event, both halves of it.
 *
 * The teams are set up once before the event, and then every round is drawn
 * from them: team against team, and the players inside each fixture in the
 * order their captain listed them. The tables that come out are ordinary
 * pairing matches with a parent, so the scores dialog, the armies dialog and
 * everything the Meta Tracker reads keep working without knowing.
 */

function refusalOf(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : String(error);
  const said = teamRefusal(raw);
  if (said) return said;
  console.error("[teams] unexpected refusal:", raw);
  return fallback;
}

export const getTeams = (eventId: number): Promise<EventTeam[]> =>
  repo.findTeams(eventId);

export const getTeamDraw = (eventId: number): Promise<TeamFixture[]> =>
  repo.findTeamDraw(eventId);

export const isTeamEvent = (eventId: number): Promise<boolean> =>
  repo.findTeamEvent(eventId).catch(() => false);

export async function setTeamEvent(eventId: number, on: boolean): Promise<Result> {
  try {
    await repo.setTeamEvent(eventId, on);
    return { ok: true,
      notice: on
        ? "This event runs as teams now."
        : "This event is back to one player per table." };
  } catch (error) {
    return { ok: false, error: refusalOf(error, "That did not save. Try again.") };
  }
}

/**
 * A team, and the people in it.
 *
 * The order the players arrive in is the order they will play, so nothing here
 * sorts them. Blanks are dropped rather than refused: a captain clearing board
 * four is taking somebody out of the team, which is the ordinary way to do it.
 */
export async function saveTeam(
  eventId: number,
  team: {
    id: number | null; name: string; position: number;
    captainProfileId: string | null;
    players: { profileId: string | null; name: string }[];
  },
): Promise<Result> {
  const name = team.name.trim();
  if (!name) return { ok: false, error: "A team needs a name." };

  const players = team.players
    .map((player) => ({ profileId: player.profileId, name: player.name.trim() }))
    .filter((player) => player.name || player.profileId);

  if (!players.length) {
    return { ok: false, error: "A team needs at least one player." };
  }

  try {
    const id = await repo.saveTeam({
      eventId, teamId: team.id, name, position: team.position,
      captainProfileId: team.captainProfileId, players,
    });
    return { ok: true, id, notice: "Team saved." };
  } catch (error) {
    return { ok: false, error: refusalOf(error, "That team did not save. Try again.") };
  }
}

export async function removeTeam(eventId: number, id: number): Promise<Result> {
  try {
    await repo.deleteTeam(eventId, id);
    return { ok: true, notice: "Team removed." };
  } catch (error) {
    return { ok: false, error: refusalOf(error, "That did not delete. Try again.") };
  }
}

/** Where a team finished. The club's word, and what the podium badge reads. */
export async function placeTeam(
  eventId: number, id: number, rank: number | null, placement: string,
): Promise<Result> {
  if (rank !== null && (!Number.isInteger(rank) || rank < 1 || rank > 999)) {
    return { ok: false, error: "A place is a whole number from 1 upwards." };
  }
  try {
    await repo.placeTeam(eventId, id, {
      final_rank: rank, placement: placement.trim().slice(0, 40),
    });
    return { ok: true,
      notice: rank === null ? "Place cleared." : `Placed ${rank}.` };
  } catch (error) {
    return { ok: false, error: refusalOf(error, "That did not save. Try again.") };
  }
}

/**
 * A whole round, at both levels, in one press.
 *
 * Fixtures first and their tables straight after, because a table names its
 * parent. Anything already in the round goes: redrawing is how a club fixes a
 * draw it made before somebody dropped out, and half a round of old fixtures
 * underneath new ones is worse than starting again.
 */
export async function drawRound(
  eventId: number, round: number, teams: EventTeam[],
): Promise<Result> {
  if (teams.length < 2) {
    return { ok: false, error: "Make at least two teams before drawing a round." };
  }

  const entrants: DrawTeam[] = teams.map((team) => ({
    id: team.id, name: team.name,
    players: team.players.map((player) => ({
      id: player.id, profileId: player.profileId, name: player.name,
    })),
  }));

  try {
    const pairingId = await pairings.ensureRound(eventId, round, "");
    await repo.clearRoundFixtures(pairingId);
    // The loose tables as well: a round redrawn after the event was switched
    // to teams would otherwise keep the individual draw underneath it.
    await pairings.clearRound(pairingId);

    const fixtures = drawTeamRound(entrants);
    let position = 0;

    for (const fixture of fixtures) {
      const id = await repo.insertFixture(pairingId, eventId, {
        table_label: fixture.label,
        team_one: fixture.teamOne.id,
        team_two: fixture.teamTwo?.id ?? null,
        position,
      });
      position += 1;

      // A bye has nobody to play, so it is a fixture with no tables rather
      // than a row of empty ones.
      if (!fixture.teamTwo) continue;

      await pairings.insertMatches(pairingId, eventId, fixture.tables.map((board, i) => ({
        table_label: board.label,
        player_one: board.one?.name ?? "",
        player_one_id: board.one?.profileId ?? null,
        player_two: board.two?.name ?? "",
        player_two_id: board.two?.profileId ?? null,
        score_one: null, score_two: null,
        position: i,
        team_match_id: id,
      })));
    }

    return { ok: true, notice: `Round ${round} drawn: ${teamDrawSummary(fixtures)}.` };
  } catch (error) {
    return { ok: false, error: refusalOf(error, "That draw did not save. Try again.") };
  }
}

/**
 * The club's own score for a fixture, or clearing it back to the total.
 *
 * Both or neither, decided here as well as in SQL: a form field is a claim,
 * and a half-typed pair would otherwise reach a constraint and come back as a
 * 23514 rather than as words.
 */
export async function scoreFixture(
  eventId: number, id: number, one: string, two: string,
): Promise<Result> {
  const blank = one.trim() === "" && two.trim() === "";
  if (!blank && (one.trim() === "" || two.trim() === "")) {
    return { ok: false, error: "Score both teams, or clear both to go back to the players' total." };
  }

  const read = (raw: string) => Math.floor(Number(raw.trim()));
  if (!blank && ([one, two].some((raw) => !/^\d{1,4}$/.test(raw.trim())))) {
    return { ok: false, error: "A team score is a whole number, 0 or more." };
  }

  try {
    await repo.saveTeamMatchPoints(id, blank ? null : read(one), blank ? null : read(two));
    return {
      ok: true,
      notice: blank
        ? "Back to the players' total."
        : "Team score saved.",
    };
  } catch (error) {
    return { ok: false, error: refusalOf(error, "That did not save. Try again.") };
  }
}

export async function removeFixture(eventId: number, id: number): Promise<Result> {
  try {
    await repo.deleteFixture(eventId, id);
    return { ok: true, notice: "Fixture removed, along with its tables." };
  } catch (error) {
    return { ok: false, error: refusalOf(error, "That did not delete. Try again.") };
  }
}
