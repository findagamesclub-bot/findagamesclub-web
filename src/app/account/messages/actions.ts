"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import * as messages from "@/services/messages.service";

export type MessageState = { error?: string; notice?: string };

/** Sending a message, from the inbox or from a club page. */
export async function messageAction(_prev: MessageState, data: FormData): Promise<MessageState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in to send a message." };

  const clubId = Number(data.get("clubId"));
  const personId = String(data.get("personId") ?? "");
  // Not `!clubId`: a message from the site carries club 0, and zero is falsy.
  if (!Number.isFinite(clubId) || clubId < 0 || !personId) {
    return { error: "Something went wrong. Reload and try again." };
  }

  const result = await messages.send(clubId, personId, String(data.get("content") ?? ""));

  // Both shells draw the same conversation, and an admin sending from the
  // console must not leave the member area holding a stale copy of it.
  for (const base of ["/account/messages", "/admin/messages"]) {
    revalidatePath(base);
    revalidatePath(`${base}/${clubId}/${personId}`);
  }
  if (!result.ok) return { error: result.error };

  // No toast on success. The message appearing in the thread is the
  // confirmation, and a banner saying so is one more thing to dismiss on a
  // page somebody is going to send five of.
  return {};
}
