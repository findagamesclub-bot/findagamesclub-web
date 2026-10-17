"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import { recordResult, removeResult } from "@/services/games.service";
import { readArmies } from "@/utils/result-form";

export type ResultState = { error?: string; notice?: string };

export async function recordResultAction(
  _prev: ResultState,
  data: FormData,
): Promise<ResultState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in to record a result." };

  const bookingId = Number(data.get("bookingId"));
  if (!bookingId) return { error: "That game could not be found." };

  const result = await recordResult({
    bookingId,
    myScore: Number(data.get("myScore")),
    theirScore: Number(data.get("theirScore")),
    myArmy: String(data.get("myArmy") ?? "").trim(),
    theirArmy: String(data.get("theirArmy") ?? "").trim(),
    armies: readArmies(data.get("armies")),
    iBooked: String(data.get("iBooked")) === "true",
    mission: String(data.get("mission") ?? ""),
    deployment: String(data.get("deployment") ?? ""),
    terrain: String(data.get("terrain") ?? ""),
    // Sent empty by a player. The function ignores it from anyone who cannot
    // manage the club, so this is belt and braces rather than the rule.
    confirmation: String(data.get("confirmation") ?? ""),
    // Absent on any screen that does not ask, which leaves the booking's own
    // game alone. Present here, so changing it to something that is not 40k
    // takes the recorded factions with it.
    game: String(data.get("game") ?? "").trim() || undefined,
    // Absent when the club does not run the army builder, which leaves any
    // link alone. "" is a real answer and means take it off.
    listId: data.get("myList") === null
      ? undefined
      : Number(data.get("myList")) || null,
  });

  if (!result.ok) return { error: result.error };
  revalidatePath("/account/games");
  return { notice: "Result saved." };
}

export async function clearResultAction(
  _prev: ResultState,
  data: FormData,
): Promise<ResultState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in first." };

  const bookingId = Number(data.get("bookingId"));
  if (!bookingId) return { error: "That game could not be found." };

  const result = await removeResult(bookingId);
  if (!result.ok) return { error: result.error };
  revalidatePath("/account/games");
  return { notice: "Result cleared." };
}
