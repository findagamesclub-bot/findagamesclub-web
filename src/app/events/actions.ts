"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import { removeAlert, saveAlert } from "@/services/eventAlerts.service";

export type AlertState = { error?: string; saved?: string };

/** Save the search currently in the URL, so new matches can find the person. */
export async function saveAlertAction(
  _state: AlertState,
  data: FormData,
): Promise<AlertState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in to save an alert." };

  const label = String(data.get("label") ?? "");
  let filters: Record<string, string> = {};
  try {
    filters = JSON.parse(String(data.get("filters") ?? "{}"));
  } catch {
    return { error: "Could not read those filters. Reload and try again." };
  }

  const result = await saveAlert(viewer.id, label, filters);
  // The saved list lives on this page, so it has to redraw or the alert you
  // just made does not appear until a reload.
  if (result.ok) revalidatePath("/events");
  return result.ok ? { saved: result.label } : { error: result.error };
}

export async function deleteAlertAction(id: number): Promise<{ error?: string }> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in to manage your alerts." };

  const result = await removeAlert(id, viewer.id);
  if (result.ok) revalidatePath("/events");
  return result.ok ? {} : { error: result.error };
}
