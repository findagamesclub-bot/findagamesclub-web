"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import { requestTierChange } from "@/services/myMemberships.service";

export type UpgradeState = { error?: string; notice?: string };

export async function requestTierAction(
  _prev: UpgradeState,
  form: FormData,
): Promise<UpgradeState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in to change your membership." };

  const membershipId = Number(form.get("membershipId"));
  if (!membershipId) return { error: "That membership could not be found." };

  // An empty tier withdraws the request rather than asking for a blank tier.
  const wanted = String(form.get("tierKey") ?? "").trim();

  const result = await requestTierChange(membershipId, viewer.id, wanted || null);
  if (!result.error) revalidatePath("/account/memberships");
  return result;
}
