"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/services/auth.service";
import * as board from "@/services/discussion-writes.service";

export type BoardState = { error?: string; notice?: string };

/**
 * Every write on the board.
 *
 * One action, as with bookings and tickets, so two hooks on one page can never
 * disagree about which message is the current one.
 */
export async function boardAction(_prev: BoardState, data: FormData): Promise<BoardState> {
  const viewer = await getCurrentProfile();
  if (!viewer) return { error: "Sign in to take part in the board." };

  const slug = String(data.get("slug") ?? "");
  const intent = String(data.get("intent") ?? "");
  if (!slug) return { error: "Something went wrong. Reload and try again." };

  const refresh = (postId?: number) => {
    revalidatePath(`/clubs/${slug}/board`);
    if (postId) revalidatePath(`/clubs/${slug}/board/${postId}`);
  };

  if (intent === "post") {
    const result = await board.createPost({
      clubId: Number(data.get("clubId")),
      category: String(data.get("category") ?? ""),
      title: String(data.get("title") ?? ""),
      content: String(data.get("content") ?? ""),
      pollQuestion: String(data.get("pollQuestion") ?? ""),
      pollOptions: data.getAll("pollOption").map(String),
      // Rendered as a pair per photo, so the two lists line up by position.
      images: data.getAll("image").map((path, i) => ({
        path: String(path),
        alt: String(data.getAll("imageAlt")[i] ?? ""),
      })),
      authorId: viewer.id,
    });

    refresh();
    if (!result.ok) return { error: result.error };
    // Onto the thread itself: a new post is something you want to look at,
    // not something to hunt for at the top of a list.
    redirect(`/clubs/${slug}/board/${result.id}`);
  }

  const postId = Number(data.get("postId"));

  if (intent === "reply") {
    const result = await board.replyToPost(postId, String(data.get("content") ?? ""));
    refresh(postId);
    return result.ok ? { notice: "Reply posted." } : { error: result.error };
  }

  if (intent === "vote") {
    const result = await board.vote(postId, String(data.get("optionKey") ?? ""));
    refresh(postId);
    return result.ok ? {} : { error: result.error };
  }

  if (intent === "remove-post") {
    const result = await board.removePost(postId);
    refresh(postId);
    if (!result.ok) return { error: result.error };
    redirect(`/clubs/${slug}/board`);
  }

  if (intent === "remove-reply") {
    const result = await board.removeReply(Number(data.get("replyId")));
    refresh(postId);
    return result.ok ? { notice: "Reply removed." } : { error: result.error };
  }

  return { error: "Something went wrong. Reload and try again." };
}
