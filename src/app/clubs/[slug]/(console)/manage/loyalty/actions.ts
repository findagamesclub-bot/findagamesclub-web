"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import { getClubAccess } from "@/services/clubAccess.service";
import { getClubDetail } from "@/services/clubDetail.service";
import * as repo from "@/repositories/clubSettings.repository";
import { MILESTONE_FIELDS } from "@/utils/loyalty";
import {
  normaliseAnniversaries, normaliseTiers, tiersProblem,
} from "@/utils/loyalty-tiers";

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

  const at = (key: string, index: number) =>
    String(data.getAll(key)[index] ?? "");

  // Rows arrive as four parallel lists, so the ladder is rebuilt by index.
  const tierRows = data.getAll("tierLabel").map((_, index) => ({
    label: at("tierLabel", index),
    points: at("tierPoints", index),
    tone: at("tierTone", index),
    rewards: at("tierRewards", index),
  }));

  // Checked again here, not only on the screen. Two tiers at the same total is
  // one tier silently missing once legacy's normaliser has run, and a form
  // field is a claim rather than a fact.
  const problem = tiersProblem(tierRows);
  if (problem) return { error: problem };

  const anniversaryRows = data.getAll("anniversaryYears").map((_, index) => ({
    years: at("anniversaryYears", index),
    points: at("anniversaryPoints", index),
  }));

  try {
    await repo.saveLoyaltySettings(club.id, {
      enabled: String(data.get("enabled") ?? "") === "yes",
      point_value: number("pointValue"),
      table_booking_price: String(data.get("bookingPrice") ?? "").trim() || null,
      milestones,
      tiers: normaliseTiers(tierRows),
      anniversaries: normaliseAnniversaries(anniversaryRows),
    });
  } catch {
    return { error: "That did not save. Try again." };
  }

  revalidatePath(`/clubs/${slug}/loyalty`);
  revalidatePath(`/clubs/${slug}/manage/loyalty`);
  return { notice: "Saved." };
}
