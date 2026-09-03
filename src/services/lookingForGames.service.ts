import "server-only";

import * as repo from "@/repositories/lookingForGames.repository";
import { isPlayingOn } from "@/repositories/bookings.repository";
import type { MembershipBenefits } from "@/types/booking";
import { postingWindow } from "@/utils/lfg-window";

/**
 * Looking for games.
 *
 * A member posts that they want an opponent on a given night; another member
 * takes them up on it and a booking appears in the poster's name with the
 * acceptor in the second seat.
 *
 * Two limits, both from the club's settings (club_store.py:3659-3671): how many
 * open posts you may hold, and how far ahead you may post. The second counts
 * bookable NIGHTS, not calendar days, which is why it takes the session list.
 */

export type LookingForGame = {
  id: number;
  clubSessionId: number;
  date: string;
  gameTitle: string;
  notes: string;
  authorName: string;
  authorId: string;
  isMine: boolean;
};

type Row = Awaited<ReturnType<typeof repo.findOpenPosts>>[number];

export async function getOpenPosts(
  clubId: number, fromDate: string, toDate: string, viewerId: string | null,
): Promise<Map<string, LookingForGame[]>> {
  const rows = await repo.findOpenPosts(clubId, fromDate, toDate);

  const byNight = new Map<string, LookingForGame[]>();
  for (const row of rows) {
    const r = row as Row & { profiles: { id: string; full_name: string } | null };
    const key = `${r.club_session_id}:${r.session_date}`;
    const list = byNight.get(key) ?? [];
    list.push({
      id: r.id,
      clubSessionId: r.club_session_id,
      date: r.session_date,
      gameTitle: r.game_title,
      notes: r.notes,
      authorName: r.profiles?.full_name || "Member",
      authorId: r.created_by,
      isMine: Boolean(viewerId && r.created_by === viewerId),
    });
    byNight.set(key, list);
  }
  return byNight;
}

export async function createPost(params: {
  clubId: number;
  profileId: string;
  clubSessionId: number;
  sessionDate: string;
  gameTitle: string;
  notes?: string;
  benefits: MembershipBenefits;
  /** Bookable nights in order, so the window can be counted in club nights. */
  bookableDates: string[];
}) {
  const gameTitle = params.gameTitle.trim();
  if (!gameTitle) return { ok: false as const, error: "Game title is required." };

  // Taking up a post creates a booking in the poster's name, so somebody who
  // already has a table that night can never have their advert accepted.
  if (await isPlayingOn(params.clubId, params.profileId, params.sessionDate)) {
    return {
      ok: false as const,
      error: "You already have a table that night. Cancel it first if you want an opponent instead.",
    };
  }

  const limit = params.benefits.lookingForGamePostLimit;
  if (limit > 0) {
    const held = await repo.countOpenPostsFor(params.clubId, params.profileId);
    if (held >= limit) {
      return {
        ok: false as const,
        error: `Your current tier allows ${limit} open looking-for-game posts at once.`,
      };
    }
  }

  // The same rule the button draws itself from, so a night the page offers is
  // never a night this refuses.
  const allowed = postingWindow(params.bookableDates, params.benefits.lookingForGameFutureDates);
  if (!allowed.includes(params.sessionDate)) {
    return {
      ok: false as const,
      error: "That club night is outside your current looking-for-game posting window.",
    };
  }

  try {
    await repo.insertPost({
      club_id: params.clubId,
      club_session_id: params.clubSessionId,
      session_date: params.sessionDate,
      game_title: gameTitle.slice(0, 120),
      notes: (params.notes ?? "").trim().slice(0, 500),
    });
    return { ok: true as const };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    if (raw.includes("club_lfg_one_open_per_date")) {
      return { ok: false as const, error: "You already have an open looking-for-game post for that club date." };
    }
    if (raw.includes("NOT_PERMITTED")) {
      return { ok: false as const, error: "Only approved club members can post." };
    }
    return { ok: false as const, error: "Could not post that. Try again." };
  }
}

export async function withdrawPost(id: number) {
  try {
    await repo.withdrawPost(id);
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "Could not withdraw that post. Try again." };
  }
}

export async function acceptPost(id: number) {
  try {
    const bookingId = await repo.acceptPost(id);
    return { ok: true as const, bookingId };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "";
    if (raw.includes("LFG_OWN_POST")) {
      return { ok: false as const, error: "That is your own post." };
    }
    if (raw.includes("LFG_NOT_AVAILABLE")) {
      return { ok: false as const, error: "Somebody got there first. That game is taken." };
    }
    if (raw.includes("BOOKING_NO_TABLES")) {
      return { ok: false as const, error: "No tables are left for that session." };
    }
    if (raw.includes("club_booking_participants_one_per_date")) {
      return { ok: false as const, error: "You already have a booking for that club date." };
    }
    if (raw.includes("NOT_PERMITTED")) {
      return { ok: false as const, error: "Only approved club members can join a game." };
    }
    return { ok: false as const, error: "Could not join that game. Try again." };
  }
}
