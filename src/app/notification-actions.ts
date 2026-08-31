"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import { getNotifications, readAll, readOne } from "@/services/notifications.service";
import type { Notification } from "@/services/notifications.service";

/** The panel asks for its rows only when somebody opens it. */
export async function loadNotificationsAction(): Promise<Notification[]> {
  const viewer = await getCurrentProfile();
  if (!viewer) return [];
  return getNotifications(viewer.id);
}

export async function readAllAction(): Promise<{ ok: boolean }> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { ok: false };

  const result = await readAll(viewer.id);
  // The badge is rendered by the layout, so the whole shell needs rebuilding.
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function readOneAction(id: number): Promise<{ ok: boolean }> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { ok: false };

  const result = await readOne(viewer.id, id);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
