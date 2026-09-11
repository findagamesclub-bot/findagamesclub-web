"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import * as repo from "@/repositories/clubSettings.repository";

export type SettingsState = { error?: string; notice?: string };

/** The coaching switch and the two pieces of text around it. */
export async function saveCoachingAction(
  _prev: SettingsState, data: FormData,
): Promise<SettingsState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in and try again." };

  const slug = String(data.get("slug") ?? "");
  const club = slug ? await getClubDetail(slug) : null;
  if (!club) return { error: "That club is not here any more." };

  const access = await getClubAccess(club.id, viewer);
  if (!access.can("coaching.manage")) {
    return { error: "You do not have permission to change this." };
  }

  try {
    await repo.saveCoachingSettings(club.id, {
      enabled: String(data.get("enabled") ?? "") === "yes",
      intro_text: String(data.get("intro") ?? "").trim() || null,
      policy_text: String(data.get("policy") ?? "").trim() || null,
    });
  } catch {
    return { error: "That did not save. Try again." };
  }

  revalidatePath(`/clubs/${slug}/coaching`);
  revalidatePath(`/clubs/${slug}/manage/coaching`);
  return { notice: "Saved." };
}
