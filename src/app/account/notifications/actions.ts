"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import { saveSetting } from "@/services/notificationPrefs.service";
import { FAMILIES, type Family } from "@/utils/notification-families";

export type SettingsState = { error?: string; notice?: string };

export async function saveSettingAction(
  _prev: SettingsState, data: FormData,
): Promise<SettingsState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Your session has expired. Sign in and try again." };

  const family = String(data.get("family") ?? "") as Family;
  if (!FAMILIES.includes(family)) {
    return { error: "That is not a setting we hold. Reload the page and try again." };
  }

  const bell = data.get("bell") === "on";
  const email = data.get("email") === "on";

  try {
    await saveSetting(family, bell, email);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("REPLIES_EMAIL_LOCKED")) {
      return { error: "Replies stay on. If somebody answers you, you hear about it." };
    }
    return { error: "We could not save that. Try again in a moment." };
  }

  revalidatePath("/account/notifications");
  // Named so the toast is a sentence about what happened, not "Saved".
  return { notice: email ? "Emails on for this." : "Emails off for this." };
}
