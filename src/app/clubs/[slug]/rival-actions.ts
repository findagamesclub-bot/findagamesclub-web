"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import * as extras from "@/services/clubExtras-writes.service";

export type RivalState = { error?: string; notice?: string };

/** Naming a rival, and taking the name back. */
export async function rivalAction(_prev: RivalState, data: FormData): Promise<RivalState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in to name a rival." };

  const slug = String(data.get("slug") ?? "");
  const intent = String(data.get("intent") ?? "");
  if (!slug) return { error: "Something went wrong. Reload and try again." };

  // Both doors. The roster is where naming a rival started; a member's own
  // profile is where it is done from now, and a page that is not revalidated
  // redraws the state the press had just undone.
  const person = String(data.get("rivalId") ?? "");
  const refresh = () => {
    revalidatePath(`/clubs/${slug}/members`);
    if (person) revalidatePath(`/members/${person}`);
  };

  if (intent === "mark") {
    const result = await extras.markRival(Number(data.get("clubId")), person);
    refresh();
    return result.ok
      ? { notice: `${String(data.get("rivalName") ?? "They")} is now one of your rivals.` }
      : { error: result.error };
  }

  if (intent === "unmark") {
    const result = await extras.unmarkRival(Number(data.get("rivalRowId")));
    refresh();
    return result.ok ? { notice: "Rivalry dropped." } : { error: result.error };
  }

  return { error: "Something went wrong. Reload and try again." };
}
