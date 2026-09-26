"use server";

import { revalidatePath } from "next/cache";

import { getCurrentProfile } from "@/services/auth.service";
import { resolve } from "@/services/moderation.service";

export type ModerationState = { error?: string; notice?: string };

export async function moderationAction(
  _prev: ModerationState, data: FormData,
): Promise<ModerationState> {
  const viewer = await getCurrentProfile();
  if (!viewer || viewer.role !== "admin") {
    return { error: "Only an admin can answer a report." };
  }

  const flag = Number(data.get("flag") ?? 0);
  if (!flag) return { error: "That report is not here any more." };

  const done = await resolve(flag, String(data.get("action") ?? ""),
    String(data.get("reason") ?? ""));
  if (!done.ok) return { error: done.error };

  revalidatePath("/admin/moderation");
  revalidatePath("/admin");
  return { notice: done.notice };
}
