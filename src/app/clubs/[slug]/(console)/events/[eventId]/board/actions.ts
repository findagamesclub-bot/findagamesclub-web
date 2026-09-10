"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/services/auth.service";
import * as board from "@/services/eventBoard.service";

export type BoardState = { error?: string; notice?: string };

/**
 * Posting, replying and withdrawing, in one action.
 *
 * The same shape as the booking and membership panels: two useActionState
 * hooks in a component can disagree, and the older notice wins.
 */
export async function eventBoardAction(
  _prev: BoardState,
  data: FormData,
): Promise<BoardState> {
  const viewer = await getCurrentProfile();
  const slug = String(data.get("slug") ?? "");
  const eventKey = String(data.get("eventKey") ?? "");
  const eventId = Number(data.get("eventId"));
  const intent = String(data.get("intent") ?? "");

  if (!viewer) return { error: "Sign in to post on the event board." };
  if (!slug || !eventKey) return { error: "Something went wrong. Reload and try again." };

  const refresh = () => {
    revalidatePath(`/clubs/${slug}/events/${eventKey}/board`);
    revalidatePath(`/clubs/${slug}/events/${eventKey}`);
  };

  if (intent === "reply") {
    const result = await board.replyOnBoard(
      Number(data.get("postId")), String(data.get("content") ?? ""));
    refresh();
    return result.ok ? { notice: "Reply posted." } : { error: result.error };
  }

  if (intent === "remove-post" || intent === "remove-reply") {
    const result = await board.removeFromBoard(
      intent === "remove-post" ? "post" : "reply",
      Number(data.get("targetId")),
      viewer.id,
    );
    refresh();
    return result.ok
      ? { notice: intent === "remove-post" ? "Thread removed." : "Reply removed." }
      : { error: result.error };
  }

  const result = await board.postToBoard({
    eventId,
    title: String(data.get("title") ?? ""),
    content: String(data.get("content") ?? ""),
  });
  refresh();
  return result.ok ? { notice: "Posted to the board." } : { error: result.error };
}
