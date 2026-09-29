"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubDetail } from "@/services/clubDetail.service";
import { setBuilder } from "@/services/armyBuilder.service";

export type BuilderState = { error?: string; notice?: string };

/**
 * The club turning the army builder on or off.
 *
 * `save_army_builder_settings` re-derives the club's permission from the club
 * itself, so the slug here is only for revalidating. A form that forgets it
 * gets a stale page rather than a refusal about a club that is plainly there,
 * which is the lesson the moderation action learned.
 */
export async function builderAction(
  _prev: BuilderState, data: FormData,
): Promise<BuilderState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in to change this." };

  const slug = String(data.get("slug") ?? "");
  const club = slug ? await getClubDetail(slug) : null;
  if (!club) return { error: "That club is not here any more." };

  const done = await setBuilder(
    club.id,
    String(data.get("enabled") ?? "") === "true",
    String(data.get("edition") ?? "") || null,
  );
  if (!done.ok) return { error: done.error };

  revalidatePath(`/clubs/${slug}/manage/army-builder`);
  revalidatePath(`/clubs/${slug}`);
  return { notice: done.notice };
}
