import "server-only";

import * as repo from "@/repositories/waitlist.repository";

/**
 * The waiting list.
 *
 * Members join a queue for a full night and are promoted automatically when
 * somebody cancels — that promotion is a database trigger, not something any
 * member can trigger, so nobody can push another member into a booking.
 *
 * Rank is derived from insertion order at read time and never stored.
 */

export type QueueEntry = {
  id: number;
  clubSessionId: number;
  date: string;
  gameTitle: string;
  name: string;
  position: number;
  isMine: boolean;
  skipped: string | null;
};

type Row = Awaited<ReturnType<typeof repo.findWaitlist>>[number];

/** Legacy stamps an entry 'skipped' forever on one failure; we explain instead. */
const SKIP_COPY: Record<string, string> = {
  "date-clash": "Passed over: already playing that night.",
  "booking-limit": "Passed over: at your booking limit that week.",
  "opponent-unavailable": "Passed over: your opponent was not free.",
  "not-a-member": "Passed over: membership not active.",
};

export async function getWaitlist(
  clubId: number, fromDate: string, toDate: string, viewerId: string | null,
): Promise<Map<string, QueueEntry[]>> {
  const rows = await repo.findWaitlist(clubId, fromDate, toDate);

  const byNight = new Map<string, QueueEntry[]>();
  for (const row of rows) {
    const r = row as Row & { profiles: { id: string; full_name: string } | null };
    const key = `${r.club_session_id}:${r.session_date}`;
    const list = byNight.get(key) ?? [];
    list.push({
      id: r.id,
      clubSessionId: r.club_session_id,
      date: r.session_date,
      gameTitle: r.game_title,
      name: r.profiles?.full_name || "Member",
      position: list.length + 1,
      isMine: Boolean(viewerId && r.requested_by === viewerId),
      skipped: r.last_skip_reason ? (SKIP_COPY[r.last_skip_reason] ?? null) : null,
    });
    byNight.set(key, list);
  }
  return byNight;
}

export async function joinQueue(params: {
  clubId: number;
  clubSessionId: number;
  sessionDate: string;
  gameTitle: string;
  notes?: string;
}) {
  const gameTitle = params.gameTitle.trim();
  if (!gameTitle) return { ok: false as const, error: "Game title is required." };

  try {
    await repo.joinWaitlist({
      club_id: params.clubId,
      club_session_id: params.clubSessionId,
      session_date: params.sessionDate,
      game_title: gameTitle.slice(0, 120),
      notes: (params.notes ?? "").trim().slice(0, 500),
    });
    return { ok: true as const };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    if (raw.includes("club_booking_waitlist_one_per_date")) {
      return { ok: false as const, error: "You are already on the waiting list for that club date." };
    }
    if (raw.includes("NOT_PERMITTED")) {
      return { ok: false as const, error: "Only approved club members can join the waiting list." };
    }
    return { ok: false as const, error: "Could not join the waiting list. Try again." };
  }
}

/** Owner promotes someone off the queue by hand, rather than waiting for a cancellation. */
export async function promoteEntry(entryId: number) {
  try {
    const bookingId = await repo.promoteAsManager(entryId);
    if (!bookingId) {
      return {
        ok: false as const,
        error: "They could not take a table: they are already playing that night, or the night is full.",
      };
    }
    return { ok: true as const, bookingId };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    if (raw.includes("NOT_PERMITTED")) {
      return { ok: false as const, error: "Only the club can hand out tables." };
    }
    if (raw.includes("BOOKING_NO_TABLES")) {
      return { ok: false as const, error: "No tables are left for that session." };
    }
    return { ok: false as const, error: "Could not give them the table. Try again." };
  }
}

export async function leaveQueue(entryId: number) {
  try {
    await repo.leaveWaitlist(entryId);
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Could not leave the waiting list. Try again." };
  }
}
