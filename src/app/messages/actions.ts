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
  if (!clubId || !personId) return { error: "Something went wrong. Reload and try again." };

  const result = await messages.send(clubId, personId, String(data.get("content") ?? ""));

  revalidatePath("/messages");
  revalidatePath(`/messages/${clubId}/${personId}`);
  if (!result.ok) return { error: result.error };

  return { notice: "Sent." };
}
