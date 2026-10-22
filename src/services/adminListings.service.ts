import "server-only";

import * as repo from "@/repositories/adminListings.repository";
import { clubSuspended, eventSuspended } from "./listing-notify.service";
import type { AdminWriteResult } from "./adminAccounts.service";

/**
 * An admin takes a listing out of the directory, with a reason (0188).
 *
 * Deliberately not a widening of `pause_club_listing`. A pause is the club's
 * own decision and it can undo it; this is ours and it cannot. 0108 drew that
 * line and the client's item is the half it left unbuilt.
 *
 * The refusals are the database's codes turned into sentences in one place,
 * so the screen that offers the button and the function that refuses it cannot
 * end up using different words for the same rung.
 */

const REFUSALS: Record<string, string> = {
  NOT_PERMITTED: "Only a site admin can take a listing down.",
  REASON_REQUIRED: "Say what happened. The owner reads this.",
  CLUB_NOT_FOUND: "That club is not here any more.",
  EVENT_NOT_FOUND: "That event is not here any more.",
  CLUB_ALREADY_DOWN: "That listing is already down.",
  EVENT_ALREADY_DOWN: "That event is already down.",
  CLUB_NOT_LIVE: "Only a club that is in the directory can be taken out of it.",
  CLUB_NOT_DOWN: "That club is not suspended, so there is nothing to put back.",
  EVENT_NOT_DOWN: "That event is not suspended, so there is nothing to put back.",
};

function refusalFrom(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  for (const [code, said] of Object.entries(REFUSALS)) {
    if (raw.includes(code)) return said;
  }
  // The cause rather than a shrug. Everything unmapped used to become "That
  // did not save" with the one thing the server knew thrown away.
  console.error("[admin] a listing write was refused", raw);
  return "That did not save. Try again.";
}

export async function takeClubDown(
  clubId: number, reason: string, actorId: string,
): Promise<AdminWriteResult> {
  try {
    await repo.suspendClub(clubId, reason);
  } catch (error) {
    return { ok: false, error: refusalFrom(error) };
  }
  // The bell is a trigger in 0188; this is the letter. Nothing in SQL has ever
  // sent an email, and a mail failure must never undo a decision.
  await clubSuspended(clubId, true, actorId).catch(() => {});
  return { ok: true, notice: "Listing taken down." };
}

export async function putClubBack(
  clubId: number, actorId: string,
): Promise<AdminWriteResult> {
  try {
    await repo.restoreClub(clubId);
  } catch (error) {
    return { ok: false, error: refusalFrom(error) };
  }
  await clubSuspended(clubId, false, actorId).catch(() => {});
  return { ok: true, notice: "Listing back in the directory." };
}

export async function takeEventDown(
  eventId: number, reason: string, actorId: string,
): Promise<AdminWriteResult> {
  try {
    await repo.suspendEvent(eventId, reason);
  } catch (error) {
    return { ok: false, error: refusalFrom(error) };
  }
  await eventSuspended(eventId, true, actorId).catch(() => {});
  return { ok: true, notice: "Event taken down." };
}

export async function putEventBack(
  eventId: number, actorId: string,
): Promise<AdminWriteResult> {
  try {
    await repo.restoreEvent(eventId);
  } catch (error) {
    return { ok: false, error: refusalFrom(error) };
  }
  await eventSuspended(eventId, false, actorId).catch(() => {});
  return { ok: true, notice: "Event back on the site." };
}

/**
 * Why a listing is down, for the banner its owner reads.
 *
 * Null for anything that is not suspended, and null for a reader the function
 * will not answer, so a caller cannot tell the two apart and does not need to:
 * both mean "draw nothing".
 */
export async function getClubSuspension(clubId: number) {
  // One wave of two. Who to write to is part of the answer to "this is down,
  // what do I do about it", and it is only ever asked on a page that is
  // already drawing the banner.
  const [rows, contacts] = await Promise.all([
    repo.findClubSuspension(clubId).catch(() => null),
    repo.findSiteContacts().catch(() => null),
  ]);
  return toSuspension(rows, contacts);
}

export async function getEventSuspension(eventId: number) {
  const [rows, contacts] = await Promise.all([
    repo.findEventSuspension(eventId).catch(() => null),
    repo.findSiteContacts().catch(() => null),
  ]);
  return toSuspension(rows, contacts);
}

function toSuspension(
  rows: repo.Suspension[] | null,
  contacts: { id: string; full_name: string }[] | null = null,
) {
  const row = rows?.[0];
  if (!row) return null;
  const admin = contacts?.[0] ?? null;
  return {
    reason: (row.reason ?? "").trim(),
    at: row.suspended_at,
    byName: (row.by_name ?? "").trim(),
    // What the club has already said about it, so the banner can answer
    // "did that go anywhere" instead of offering the button again.
    askedAt: row.asked_at ?? null,
    askedNote: (row.asked_note ?? "").trim(),
    /**
     * Somebody to write to about it (0215).
     *
     * The client asked for a message admin button, and 0202 recorded why it
     * did not build one: a site thread could only ever be opened by an admin
     * going first. That is still right about the general case and wrong about
     * this one, so an owner with something down may open it, and this is who
     * they reach. Null everywhere else, and the button is not drawn.
     */
    adminId: admin?.id ?? null,
    adminName: (admin?.full_name ?? "").trim(),
  };
}

/**
 * "I have put it right, please look again."
 *
 * The client asked how an owner resolves a suspension, and until now the
 * answer was that they could not: the banner told them only an admin could put
 * it back. Their own two suggestions were a message button and sending it back
 * through club requests; the second does not reach an event, which they said
 * themselves, and the first does not exist, because `getContacts` only ever
 * returns clubmates so a member cannot start a thread with the site.
 *
 * So it is one action on the thing that was taken down, for both kinds.
 */
export async function askSuspensionReview(
  kind: "club" | "event", id: number, note: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await repo.askSuspensionReview(kind, id, note.trim().slice(0, 1000));
    return { ok: true };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    if (raw.includes("REVIEW_NOT_DOWN")) {
      return { ok: false, error: "That is not taken down, so there is nothing to look at again." };
    }
    if (raw.includes("NOT_PERMITTED") || raw.includes("REVIEW_SIGN_IN")) {
      return { ok: false, error: "Only the club can ask for another look at this." };
    }
    console.error("ask for review failed", { kind, id, raw });
    return { ok: false, error: "That did not send. Try again." };
  }
}

export type ListingSuspension = NonNullable<Awaited<ReturnType<typeof getClubSuspension>>>;

/**
 * "I have looked, and it stays down."
 *
 * The other half of the decision. Putting a listing back has existed since
 * 0188; keeping it down had no answer at all, so an ask sat on the admin's
 * screen forever and the owner was never told their answer had been read.
 *
 * It replaces the reason the listing carries, because the admin has just said
 * what is still wrong and that sentence is the one the owner should be
 * reading on their own banner. The listing does not move: it was down and it
 * stays down, and what changes is whose turn it is.
 */
export async function keepSuspension(
  kind: "club" | "event", id: number, note: string,
): Promise<{ ok: boolean; error?: string }> {
  const words = note.trim().slice(0, 1000);
  if (!words) {
    return { ok: false, error: "Say what is still wrong. It is what they will read." };
  }
  try {
    await repo.keepSuspension(kind, id, words);
    return { ok: true };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    if (raw.includes("REVIEW_NEEDS_REASON")) {
      return { ok: false, error: "Say what is still wrong. It is what they will read." };
    }
    if (raw.includes("REVIEW_NOT_DOWN")) {
      return { ok: false, error: "That is not taken down, so there is nothing to keep." };
    }
    if (raw.includes("NOT_PERMITTED")) {
      return { ok: false, error: "Only a site admin can answer this." };
    }
    console.error("keep suspension failed", { kind, id, raw });
    return { ok: false, error: "That did not save. Try again." };
  }
}
