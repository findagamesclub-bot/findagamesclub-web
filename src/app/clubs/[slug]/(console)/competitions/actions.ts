"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readArmies } from "@/utils/result-form";
import { getCurrentProfile } from "@/services/auth.service";
import * as comps from "@/services/competitions-writes.service";

export type CompetitionState = { error?: string; notice?: string };

/** Everything a club does to its own competitions. */
export async function competitionAction(
  _prev: CompetitionState,
  data: FormData,
): Promise<CompetitionState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in to manage competitions." };

  const slug = String(data.get("slug") ?? "");
  const intent = String(data.get("intent") ?? "");
  if (!slug) return { error: "Something went wrong. Reload and try again." };

  const refresh = (competitionId?: number) => {
    revalidatePath(`/clubs/${slug}/competitions`);
    revalidatePath(`/clubs/${slug}/competitions/manage`);
    if (competitionId) revalidatePath(`/clubs/${slug}/competitions/manage/${competitionId}`);
  };

  const form = (): comps.CompetitionForm => ({
    title: String(data.get("title") ?? ""),
    type: String(data.get("type") ?? ""),
    status: String(data.get("status") ?? ""),
    season: String(data.get("season") ?? ""),
    game: String(data.get("game") ?? ""),
    summary: String(data.get("summary") ?? ""),
    startDate: String(data.get("startDate") ?? ""),
    endDate: String(data.get("endDate") ?? ""),
  });

  if (intent === "create") {
    const result = await comps.createCompetition(Number(data.get("clubId")), form());
    if (!result.ok) return { error: result.error };
    refresh();
    // Straight into the table: a competition with no players in it is not
    // finished, and the next thing anybody wants is to add them.
    redirect(`/clubs/${slug}/competitions/manage/${result.id}`);
  }

  const competitionId = Number(data.get("competitionId"));

  if (intent === "edit") {
    const result = await comps.editCompetition(competitionId, form());
    if (!result.ok) return { error: result.error };
    refresh(competitionId);
    return { notice: "Competition saved." };
  }

  if (intent === "delete") {
    const result = await comps.removeCompetition(competitionId);
    if (!result.ok) return { error: result.error };
    refresh();
    redirect(`/clubs/${slug}/competitions/manage`);
  }

  if (intent === "standings") {
    let rows: comps.StandingForm[] = [];
    try {
      const raw: unknown = JSON.parse(String(data.get("rows") ?? "[]"));
      if (Array.isArray(raw)) rows = raw as comps.StandingForm[];
    } catch {
      return { error: "Something went wrong with the table. Reload and try again." };
    }

    const result = await comps.saveStandings(competitionId, rows);
    if (!result.ok) return { error: result.error };
    refresh(competitionId);
    return { notice: "Table saved." };
  }

  // What was played in one game of a round. Its own intent rather than part
  // of the round save, because the two are different jobs: a club types the
  // scores for a whole round in one go and comes back to the armies when
  // somebody hands the lists over.
  if (intent === "game-result") {
    const matchId = Number(data.get("gameId")) || 0;
    if (!matchId) {
      return { error: "Save the round first, then say what was played." };
    }

    const sides = readArmies(data.get("armies"));
    if (!sides) {
      return { error: "Something went wrong with the armies. Reload and try again." };
    }

    const result = await comps.saveGameResult({
      matchId,
      armies: sides,
      lists: {
        one: Number(data.get("oneList")) || null,
        two: Number(data.get("twoList")) || null,
      },
      setup: {
        mission: String(data.get("mission") ?? ""),
        deployment: String(data.get("deployment") ?? ""),
        terrain: String(data.get("terrain") ?? ""),
      },
    });
    if (!result.ok) return { error: result.error };
    refresh(competitionId);
    return { notice: "What was played is saved." };
  }

  if (intent === "round") {
    let matches: comps.RoundForm["matches"] = [];
    try {
      const raw: unknown = JSON.parse(String(data.get("matches") ?? "[]"));
      if (Array.isArray(raw)) matches = raw as comps.RoundForm["matches"];
    } catch {
      return { error: "Something went wrong with the games. Reload and try again." };
    }

    const roundId = Number(data.get("roundId")) || null;
    const result = await comps.saveRound({
      competitionId,
      roundId,
      position: Number(data.get("position")) || 0,
      form: {
        postedOn: String(data.get("postedOn") ?? ""),
        title: String(data.get("title") ?? ""),
        summary: String(data.get("summary") ?? ""),
        matches,
      },
    });
    if (!result.ok) return { error: result.error };
    refresh(competitionId);
    return { notice: "Round saved." };
  }

  if (intent === "delete-round") {
    const result = await comps.removeRound(Number(data.get("roundId")));
    if (!result.ok) return { error: result.error };
    refresh(competitionId);
    return { notice: "Round removed." };
  }

  return { error: "Something went wrong. Reload and try again." };
}
