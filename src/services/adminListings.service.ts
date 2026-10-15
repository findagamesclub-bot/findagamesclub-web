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
  const rows = await repo.findClubSuspension(clubId).catch(() => null);
  return toSuspension(rows);
}

export async function getEventSuspension(eventId: number) {
  const rows = await repo.findEventSuspension(eventId).catch(() => null);
  return toSuspension(rows);
}

function toSuspension(rows: repo.Suspension[] | null) {
  const row = rows?.[0];
  if (!row) return null;
  return {
    reason: (row.reason ?? "").trim(),
    at: row.suspended_at,
    byName: (row.by_name ?? "").trim(),
  };
}

export type ListingSuspension = NonNullable<Awaited<ReturnType<typeof getClubSuspension>>>;
