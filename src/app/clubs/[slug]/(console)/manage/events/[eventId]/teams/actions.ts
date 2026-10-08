"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import { getEvent } from "@/services/eventEditor.service";
import * as teams from "@/services/eventTeams.service";

export type TeamsState = { error?: string; notice?: string };

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

  // Read through the club, so an event id from another club cannot be reached.
  const event = await getEvent(club.id, eventId);
  if (!event) return { error: "That event is not here any more." as const };

  return { slug, event };
}

/** One entry point, for the reason the draw's own action gives. */
export async function teamsAction(
  _prev: TeamsState, data: FormData,
): Promise<TeamsState> {
  const gate = await open(data);
  if ("error" in gate) return { error: gate.error };

  const { slug, event } = gate;
  const intent = String(data.get("intent") ?? "");

  const result = await (async () => {
    switch (intent) {
      case "team-event":
        return teams.setTeamEvent(event.id, String(data.get("on") ?? "") === "yes");

      case "save-team": {
        // One row per player, posted as parallel lists: a form cannot post a
        // shape, and a key nobody types is a key nobody can see has gone.
        const at = (key: string, index: number) => String(data.getAll(key)[index] ?? "");
        const players = data.getAll("playerName").map((_, index) => ({
          profileId: at("playerProfileId", index) || null,
          name: at("playerName", index),
        }));

        return teams.saveTeam(event.id, {
          id: Number(data.get("teamId")) || null,
          name: String(data.get("name") ?? ""),
          position: Number(data.get("position")) || 0,
          captainProfileId: String(data.get("captainProfileId") ?? "") || null,
          players,
        });
      }

      case "remove-team":
        return teams.removeTeam(event.id, Number(data.get("teamId")) || 0);

      case "place-team": {
        const rank = String(data.get("rank") ?? "").trim();
        return teams.placeTeam(event.id, Number(data.get("teamId")) || 0,
          rank === "" ? null : Math.floor(Number(rank)),
          String(data.get("placement") ?? ""));
      }

      default:
        return { ok: false as const, error: "Something went wrong. Reload and try again." };
    }
  })();

  if (!result.ok) return { error: result.error };

  revalidatePath(`/clubs/${slug}/manage/events/${event.id}/teams`);
  revalidatePath(`/clubs/${slug}/manage/events/${event.id}/pairings`);
  revalidatePath(`/clubs/${slug}/events/${event.legacyId}`);
  return { notice: result.notice };
}
