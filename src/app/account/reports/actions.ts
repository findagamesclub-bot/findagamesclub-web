"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import { withdrawReport } from "@/services/myReports.service";

export type WithdrawState = { error?: string; notice?: string };

/**
 * Taking a report back.
 *
 * The database decides whether it is yours and whether it is still open, so
 * nothing is checked twice here. Revalidated, unlike reporting: this one does
 * change what the page in front of the reader should say.
 */
export async function withdrawAction(
  _prev: WithdrawState, data: FormData,
): Promise<WithdrawState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in to manage your reports." };

  const done = await withdrawReport(Number(data.get("flag") ?? 0));
  if (!done.ok) return { error: done.error };

  revalidatePath("/account/reports");
  return { notice: done.notice };
}
