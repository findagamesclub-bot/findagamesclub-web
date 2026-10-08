"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import { recordClubResult } from "@/services/games.service";
import { readArmies } from "@/utils/result-form";

export type ClubResultState = { error?: string; notice?: string };

/** The club settling a result on a game it did not play in. */
export async function clubResultAction(
  _prev: ClubResultState,
  data: FormData,
): Promise<ClubResultState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in to settle a result." };

  const bookingId = Number(data.get("bookingId"));
  if (!bookingId) return { error: "That game could not be found." };

  const result = await recordClubResult({
    bookingId,
    homeScore: Number(data.get("homeScore")),
    awayScore: Number(data.get("awayScore")),
    homeArmy: String(data.get("homeArmy") ?? "").trim(),
    awayArmy: String(data.get("awayArmy") ?? "").trim(),
    // Already in the booking's order here: the club's dialog names whoever
    // booked first, so there is nothing to turn round.
    armies: readArmies(data.get("armies")),
    mission: String(data.get("mission") ?? ""),
    deployment: String(data.get("deployment") ?? ""),
    terrain: String(data.get("terrain") ?? ""),
    confirmation: String(data.get("confirmation") ?? ""),
    // Absent leaves the booking's own game alone. Present and not 40k clears
    // the factions, because the cascade they came from is 40k's.
    game: String(data.get("game") ?? "").trim() || undefined,
  });

  if (!result.ok) return { error: result.error };

  const slug = String(data.get("slug") ?? "");
  if (slug) revalidatePath(`/clubs/${slug}/bookings`);
  revalidatePath("/account/games");
  return { notice: "Result saved." };
}
