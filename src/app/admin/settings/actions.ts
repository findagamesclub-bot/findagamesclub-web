"use server";

import { getCurrentProfile } from "@/services/auth.service";
import { saveSiteSettings } from "@/services/siteSettings.service";

export type SettingsState = { error?: string; notice?: string };

/**
 * Save one of the site settings.
 *
 * Re-checks the role before doing anything, matching every other admin action:
 * the layout redirect draws the console, it does not guard the write. The
 * database refuses a non-admin too, and the zero-row pattern is what turns that
 * refusal into a message rather than a silent success.
 */
export async function saveSettingAction(
  _prev: SettingsState, data: FormData,
): Promise<SettingsState> {
  const viewer = await getCurrentProfile();
  if (!viewer || viewer.role !== "admin") {
    return { error: "Only an admin can change the site settings." };
  }

  const field = String(data.get("field") ?? "");
  const value = String(data.get("value") ?? "");

  const column = field === "contact" ? "contact_email"
    : field === "terms" ? "terms_md"
      : field === "privacy" ? "privacy_md"
        : field === "cookies" ? "cookies_md"
          : null;

  if (!column) return { error: "That setting does not exist." };

  if (column === "contact_email" && value.trim()
      && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
    return { error: "That does not look like an email address." };
  }

  const result = await saveSiteSettings({ [column]: value.trim() });
  if (!result.ok) return { error: result.error };

  // Says where it landed, because the whole point of this screen is that it
  // publishes something a visitor can read.
  return {
    notice: column === "contact_email"
      ? "Saved. That address is on the contact page now."
      : "Saved. It is live on the site now.",
  };
}
