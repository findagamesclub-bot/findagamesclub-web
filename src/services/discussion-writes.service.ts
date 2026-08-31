import "server-only";

import * as repo from "@/repositories/discussions.repository";
import { buildPoll } from "@/utils/poll";
import { MAX_POST_IMAGES, toPostImages } from "@/utils/post-images";

/**
 * Writing to the board.
 *
 * Split from discussions.service so the read path stays a pure mapper. Every
 * refusal here is really RLS refusing: the checks are for the message, not for
 * the security, which lives in the policies.
 */

type Result = { ok: true; id?: number } | { ok: false; error: string };

function refusal(raw: string, fallback: string): string {
  if (raw.includes("NOT_PERMITTED") || raw.includes("row-level security")) {
    return "Only approved members can post here, and some categories need a higher tier.";
  }
  if (raw.includes("_content_len") || raw.includes("_title_len")) {
    return "That is too long. Trim it and try again.";
  }
  return fallback;
}

export async function createPost(params: {
  clubId: number;
  category: string;
  title: string;
  content: string;
  pollQuestion: string;
  pollOptions: string[];
  images: { path: string; alt: string }[];
  /** Whose folder the photos must be in. */
  authorId: string;
}): Promise<Result> {
  const title = params.title.trim();
  const content = params.content.trim();
  const category = params.category.trim();

  if (!title) return { ok: false, error: "Give the thread a title." };
  if (!content) return { ok: false, error: "Write something before posting." };
  if (!category) return { ok: false, error: "Choose a category." };

  // A question with one answer is not a poll. Saying so beats dropping it
  // silently and leaving them to notice the poll never appeared.
  const wantsPoll = Boolean(params.pollQuestion.trim());
  const poll = buildPoll(params.pollQuestion, params.pollOptions);
  if (wantsPoll && !poll) {
    return { ok: false, error: "A poll needs a question and at least two answers." };
  }

  // Re-read through the same parser the page uses, so a hand-built form
  // cannot post twenty paths or a path that is not a string.
  const images = toPostImages(params.images);
  if (params.images.length > MAX_POST_IMAGES) {
    return { ok: false, error: "Two photos at most on a thread." };
  }
  // Storage already refuses a write outside somebody's own folder; this stops
  // a hand-built form pointing a post at a file it does not own.
  if (images.some((image) => !image.path.startsWith(`${params.authorId}/`))) {
    return { ok: false, error: "Those photos did not upload properly. Try again." };
  }

  try {
    const row = await repo.insertPost({
      clubId: params.clubId, category, title, content, poll, images,
    });
    return { ok: true, id: row.id };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    return { ok: false, error: refusal(raw, "Could not post that. Try again.") };
  }
}

export async function replyToPost(postId: number, content: string): Promise<Result> {
  const clean = content.trim();
  if (!clean) return { ok: false, error: "Write a reply before sending." };

  try {
    const row = await repo.insertReply(postId, clean);
    return { ok: true, id: row.id };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    return { ok: false, error: refusal(raw, "Could not post that reply. Try again.") };
  }
}

function removalError(raw: string, thing: string): string {
  if (raw.includes("NOT_FOUND")) return `That ${thing} has already gone.`;
  if (raw.includes("NOT_SIGNED_IN")) return "Sign in to take part in the board.";
  return `That ${thing} is not yours to remove.`;
}

export async function removePost(postId: number): Promise<Result> {
  try {
    await repo.removePost(postId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: removalError(error instanceof Error ? error.message : "", "thread") };
  }
}

export async function removeReply(replyId: number): Promise<Result> {
  try {
    await repo.removeReply(replyId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: removalError(error instanceof Error ? error.message : "", "reply") };
  }
}

export async function vote(postId: number, optionKey: string): Promise<Result> {
  if (!optionKey.trim()) return { ok: false, error: "Choose an answer." };

  try {
    await repo.castVote(postId, optionKey.trim());
    return { ok: true };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    return { ok: false, error: refusal(raw, "Could not record that vote. Try again.") };
  }
}
