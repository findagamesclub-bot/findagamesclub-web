import "server-only";

import * as repo from "@/repositories/clubs.repository";
import { MAX_NOTICES, MAX_NOTICE_LENGTH } from "@/utils/noticeboard";

export type NoticeInput = { id: number | null; message: string };
export type NoticeResult = { ok: true } | { ok: false; error: string };

/**
 * The club's noticeboard.
 *
 * Its own service because the noticeboard is its own screen now. It used to be
 * one panel inside step four of the listing builder, which meant two things
 * that were both wrong: only somebody with `listing.edit` could pin a notice
 * up, and saving the club's opening hours re-wrote the board as a side effect.
 */
export async function saveNotices(
  clubId: number, notices: NoticeInput[],
): Promise<NoticeResult> {
  const kept = notices
    .map((n) => ({ id: n.id, message: n.message.trim().slice(0, MAX_NOTICE_LENGTH) }))
    .filter((n) => n.message !== "");

  if (kept.length > MAX_NOTICES) {
    return {
      ok: false,
      error: `A noticeboard holds ${MAX_NOTICES} notices. Take one down to add another.`,
    };
  }

  try {
    await repo.saveClubNotices(clubId, kept);
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    if (raw.includes("NOT_PERMITTED")) {
      return { ok: false, error: "You cannot change this club's noticeboard." };
    }
    console.error("[noticeboard] unexpected refusal:", raw);
    return { ok: false, error: "Could not save the noticeboard. Try again." };
  }

  return { ok: true };
}
