import "server-only";

import * as repo from "@/repositories/memberCodes.repository";
import { looksLikeMemberCode } from "@/utils/member-code";

export type CodeHolder = { id: string; name: string };

/**
 * The caller's own code, made on the first look.
 *
 * Catches rather than throws: a profile page that will not load because a
 * code could not be made is a worse outcome than a panel that says so, and
 * every other read on that page is unaffected.
 */
export async function getMyMemberCode(): Promise<string | null> {
  return repo.readMyCode().catch(() => null);
}

export async function rotateMyMemberCode(): Promise<
  { ok: true; code: string } | { ok: false; error: string }
> {
  try {
    return { ok: true, code: await repo.rotateMyCode() };
  } catch {
    return { ok: false, error: "Could not make a new code. Try again." };
  }
}

/**
 * Who holds this code, for somebody typing a name into their own club.
 *
 * Three answers, not two: somebody, nobody, or the question was never asked
 * because what was typed is not a code. The screen words all three, so this
 * only has to tell them apart.
 */
export async function lookUpMemberCode(
  clubId: number, code: string,
): Promise<{ found: CodeHolder | null; error?: string }> {
  if (!looksLikeMemberCode(code)) {
    return { found: null, error: "That is not a member code. It is 8 characters." };
  }
  try {
    const rows = await repo.findByCode(clubId, code);
    const row = rows?.[0];
    if (!row) {
      return { found: null, error: "No member has that code. Check it with them." };
    }
    return { found: { id: row.profile_id, name: row.full_name } };
  } catch {
    return { found: null, error: "Could not check that code. Try again." };
  }
}

/**
 * How many rows on this event the viewer could put their name to.
 *
 * Asked only when the viewer holds a ticket, because that is the first thing
 * the function itself checks and most readers of an event page hold none. Zero
 * on any failure, so a page never grows a control it cannot honour.
 */
export async function countClaimableNames(eventId: number): Promise<number> {
  return repo.countClaimable(eventId).then((n) => Number(n) || 0).catch(() => 0);
}

export async function claimEventNames(
  eventId: number,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  try {
    return { ok: true, count: Number(await repo.claimNames(eventId)) || 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("NOTHING_TO_CLAIM")) {
      return { ok: false, error: "There is nothing here under your name any more." };
    }
    return { ok: false, error: "Could not attach those. Try again." };
  }
}
