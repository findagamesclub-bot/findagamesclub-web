"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import { recordResult, removeResult } from "@/services/games.service";

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
    iBooked: String(data.get("iBooked")) === "true",
    mission: String(data.get("mission") ?? ""),
    deployment: String(data.get("deployment") ?? ""),
    terrain: String(data.get("terrain") ?? ""),
    // Sent empty by a player. The function ignores it from anyone who cannot
    // manage the club, so this is belt and braces rather than the rule.
    confirmation: String(data.get("confirmation") ?? ""),
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
