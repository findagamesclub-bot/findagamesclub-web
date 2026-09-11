"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import * as repo from "@/repositories/clubSettings.repository";
import { MILESTONE_FIELDS } from "@/utils/loyalty";

export type SettingsState = { error?: string; notice?: string };

export async function saveLoyaltyAction(
  _prev: SettingsState, data: FormData,
): Promise<SettingsState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in and try again." };

  const slug = String(data.get("slug") ?? "");
  const club = slug ? await getClubDetail(slug) : null;
  if (!club) return { error: "That club is not here any more." };

  const access = await getClubAccess(club.id, viewer);
  if (!access.can("members.manage")) {
    return { error: "You do not have permission to change this." };
  }

  const number = (key: string): number | null => {
    const raw = String(data.get(key) ?? "").trim();
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : null;
  };

  const milestones: Record<string, number> = {};
  for (const { key } of MILESTONE_FIELDS) milestones[key] = number(`milestone-${key}`) ?? 0;

  try {
    await repo.saveLoyaltySettings(club.id, {
      enabled: String(data.get("enabled") ?? "") === "yes",
      point_value: number("pointValue"),
      table_booking_price: String(data.get("bookingPrice") ?? "").trim() || null,
      milestones,
    });
  } catch {
    return { error: "That did not save. Try again." };
  }

  revalidatePath(`/clubs/${slug}/loyalty`);
  revalidatePath(`/clubs/${slug}/manage/loyalty`);
  return { notice: "Saved." };
}
