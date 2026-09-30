"use server";

import { unsubscribe } from "@/services/notificationPrefs.service";

export type UnsubscribeState = { error?: string; done?: string };

/**
 * The press.
 *
 * No sign-in check on purpose. The person who most wants to unsubscribe is the
 * person least willing to log in to do it, and the token is what identifies
 * them. It carries no address and no name, and it can do exactly one thing.
 */
export async function unsubscribeAction(
  _prev: UnsubscribeState, data: FormData,
): Promise<UnsubscribeState> {
  const token = String(data.get("token") ?? "");
  if (!token) return { error: "That link is missing its code. Use the link in the email." };

  try {
    const result = await unsubscribe(token);
    if (!result) {
      return { error: "We do not recognise that link. It may have been replaced by a newer email." };
    }
    return { done: result.label };
  } catch {
    return { error: "We could not change that just now. Try the link again in a moment." };
  }
}
