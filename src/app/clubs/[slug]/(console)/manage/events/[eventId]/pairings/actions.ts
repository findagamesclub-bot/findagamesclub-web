"use server";
import { readArmies } from "@/utils/result-form";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import { getEvent } from "@/services/eventEditor.service";
import * as pairings from "@/services/eventPairings.service";
import * as armies from "@/services/eventPairingArmies.service";
import * as draw from "@/services/eventDraw.service";
import * as teams from "@/services/eventTeams.service";

export type PairingsState = { error?: string; notice?: string };

async function open(data: FormData) {
  const slug = String(data.get("slug") ?? "");
  const eventId = Number(data.get("eventId"));

  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in and try again." as const };

  const club = slug ? await getClubDetail(slug) : null;
  if (!club) return { error: "That club is not here any more." as const };

  const access = await getClubAccess(club.id, viewer);
  if (!access.can("events.manage")) {
    return { error: "You do not have permission to change this." as const };
  }
  if (!Number.isFinite(eventId)) {
    return { error: "Something went wrong. Reload and try again." as const };
  }

  // Read through the club so an event id from another club cannot be reached.
  const event = await getEvent(club.id, eventId);
  if (!event) return { error: "That event is not here any more." as const };

  return { slug, event };
}

function refresh(slug: string, eventId: number, legacyId: string) {
  revalidatePath(`/clubs/${slug}/manage/events/${eventId}/pairings`);
  revalidatePath(`/clubs/${slug}/events/${legacyId}`);
}

/**
 * One entry point for the whole page.
 *
 * Every one of these needs the same four checks and the same refresh, and six
 * exported actions that differ by three lines is six places for one of them to
 * drift.
 */
export async function pairingsAction(
  _prev: PairingsState, data: FormData,
): Promise<PairingsState> {
  const gate = await open(data);
  if ("error" in gate) return { error: gate.error };

  const { slug, event } = gate;
  const intent = String(data.get("intent") ?? "");
  const round = Number(data.get("round")) || 1;
  const label = String(data.get("label") ?? "").trim() || `Round ${round}`;
  const pairingId = Number(data.get("pairingId")) || 0;

  const result = await (async () => {
    switch (intent) {
      case "generate":
        return draw.generateRound(event.id, round, label);

      case "generate-teams":
        // The teams are read here rather than posted, so a tab left open
        // while somebody added a team draws the teams that exist now.
        return teams.drawRound(event.id, round, await teams.getTeams(event.id));

      case "score-fixture":
        return teams.scoreFixture(event.id, Number(data.get("fixtureId")) || 0,
          String(data.get("teamPointsOne") ?? ""),
          String(data.get("teamPointsTwo") ?? ""));

      case "add-fixture":
        return teams.addFixture(event.id, round,
          Number(data.get("teamOne")) || 0, Number(data.get("teamTwo")) || 0);

      case "remove-fixture":
        return teams.removeFixture(event.id, Number(data.get("fixtureId")) || 0);

      case "paste":
        return draw.pasteRound(event.id, round, label, String(data.get("pasted") ?? ""));

      case "save-match":
        return pairings.saveMatch(event.id, round, label, {
          id: Number(data.get("matchId")) || null,
          tableLabel: String(data.get("tableLabel") ?? ""),
          playerOne: String(data.get("playerOne") ?? ""),
          playerOneId: String(data.get("playerOneId") ?? "") || null,
          playerTwo: String(data.get("playerTwo") ?? ""),
          playerTwoId: String(data.get("playerTwoId") ?? "") || null,
          position: Number(data.get("position")) || 0,
          // The fixture a new table belongs to at a team event. Absent on an
          // ordinary draw, and absent on an edit, where the table already
          // knows which fixture it is under.
          teamMatchId: Number(data.get("teamMatchId")) || null,
        });

      case "save-scores": {
        const at = (key: string, index: number) => String(data.getAll(key)[index] ?? "").trim();
        const scores = data.getAll("scoreMatchId").map((_, index) => {
          const one = at("scoreOne", index);
          const two = at("scoreTwo", index);
          const pOne = at("pointsOne", index);
          const pTwo = at("pointsTwo", index);
          return {
            id: Number(at("scoreMatchId", index)),
            // Both boxes empty is a table nobody has finished, not a nil-nil,
            // and clearing them is how a mis-entered result is taken back.
            scoreOne: one === "" ? null : Math.floor(Number(one)),
            scoreTwo: two === "" ? null : Math.floor(Number(two)),
            // The format's own figure for the table, which a team event asks
            // for beside the victory points and nothing else sends.
            pointsOne: pOne === "" ? null : Math.floor(Number(pOne)),
            pointsTwo: pTwo === "" ? null : Math.floor(Number(pTwo)),
          };
        }).filter((row) => Number.isFinite(row.id) && row.id > 0);

        if (scores.some((row) =>
          (row.scoreOne !== null && !Number.isFinite(row.scoreOne))
          || (row.scoreTwo !== null && !Number.isFinite(row.scoreTwo))
          || (row.pointsOne !== null && !Number.isFinite(row.pointsOne))
          || (row.pointsTwo !== null && !Number.isFinite(row.pointsTwo)))) {
          return { ok: false as const, error: "A score has to be a whole number." };
        }
        return pairings.saveScores(pairingId, scores);
      }

      case "remove-match":
        return pairings.removeMatch(pairingId, Number(data.get("matchId")) || 0);

      case "save-armies": {
        const matchId = Number(data.get("matchId")) || 0;
        if (!matchId) {
          return { ok: false as const, error: "Save the table first, then say what was played." };
        }
        // Both armies arrive as one JSON field, which is what `ArmyFields`
        // on a table booking has always done: a side is nine things now
        // rather than four, and nine named fields per side is eighteen keys
        // nobody types and any of which can go missing unnoticed.
        const sides = readArmies(data.get("armies"));
        if (!sides) {
          return { ok: false as const,
                   error: "Something went wrong with the armies. Reload and try again." };
        }
        const list = (which: string) => Number(data.get(`${which}List`)) || null;

        return armies.saveMatchArmies(matchId,
          sides,
          { one: list("one"), two: list("two") },
          {
            mission: String(data.get("mission") ?? ""),
            deployment: String(data.get("deployment") ?? ""),
            terrain: String(data.get("terrain") ?? ""),
          });
      }

      case "draw-audience":
        return pairings.setDrawPublic(event.id,
          String(data.get("drawPublic") ?? "") === "yes");

      case "publish":
        return pairings.publishRound(event.id, pairingId,
          String(data.get("published") ?? "") === "yes");

      case "remove-round":
        return pairings.removeRound(event.id, pairingId);

      default:
        return { ok: false as const, error: "Something went wrong. Reload and try again." };
    }
  })();

  if (!result.ok) return { error: result.error };

  refresh(slug, event.id, event.legacyId);
  return { notice: result.notice };
}
