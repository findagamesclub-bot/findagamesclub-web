"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import { getEvent } from "@/services/eventEditor.service";
import * as pairings from "@/services/eventPairings.service";
import * as draw from "@/services/eventDraw.service";

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
        });

      case "save-scores": {
        const at = (key: string, index: number) => String(data.getAll(key)[index] ?? "").trim();
        const scores = data.getAll("scoreMatchId").map((_, index) => {
          const one = at("scoreOne", index);
          const two = at("scoreTwo", index);
          return {
            id: Number(at("scoreMatchId", index)),
            // Both boxes empty is a table nobody has finished, not a nil-nil,
            // and clearing them is how a mis-entered result is taken back.
            scoreOne: one === "" ? null : Math.floor(Number(one)),
            scoreTwo: two === "" ? null : Math.floor(Number(two)),
          };
        }).filter((row) => Number.isFinite(row.id) && row.id > 0);

        if (scores.some((row) =>
          (row.scoreOne !== null && !Number.isFinite(row.scoreOne))
          || (row.scoreTwo !== null && !Number.isFinite(row.scoreTwo)))) {
          return { ok: false as const, error: "A score has to be a whole number." };
        }
        return pairings.saveScores(pairingId, scores);
      }

      case "remove-match":
        return pairings.removeMatch(pairingId, Number(data.get("matchId")) || 0);

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
