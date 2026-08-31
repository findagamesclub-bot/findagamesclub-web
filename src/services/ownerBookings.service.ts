import "server-only";

import * as repo from "@/repositories/bookings.repository";
import { findOwnedClubs } from "@/repositories/ownerInbox.repository";
import { londonToday } from "./bookingCalendar.service";
import { isLocked, toConfirmation, type ConfirmationState } from "@/utils/result-meta";
import { getOrders } from "./clubExtras.service";
import type { ClubResult } from "./clubResults.service";
import type { MerchOrder } from "@/types/clubExtras";

/**
 * Bookings and results across every club a person owns.
 *
 * The club pages answer "what is happening here". Somebody running four clubs
 * asking "what is waiting on me" had to open four pages to find out, which is
 * why legacy keeps Bookings and Score Approvals as workspace sections rather
 * than only on the club.
 */

export type OwnerClubRef = { id: number; slug: string; name: string };

/** A game or a booking, with the club it belongs to attached. */
export type OwnerResult = ClubResult & { club: OwnerClubRef };

/** A merchandise order, with the club it was placed at attached. */
export type OwnerOrder = MerchOrder & { club: OwnerClubRef };

export type ScoreQueue = {
  clubs: OwnerClubRef[];
  /** Recorded by a player and not yet ruled on. */
  pending: OwnerResult[];
  /** Players disagree. Stuck until the club settles it. */
  contested: OwnerResult[];
  /** Played, but nobody has put a score on it. */
  unscored: OwnerResult[];
  /** Settled by the club, newest first. Kept short: it is a record, not a job. */
  settled: OwnerResult[];
};

type Person = { id: string; full_name: string | null } | null;
const nameOf = (p: Person, fallback: string) => p?.full_name?.trim() || fallback;

function toResult(row: unknown, clubs: Map<number, OwnerClubRef>): OwnerResult | null {
  const r = row as {
    id: number; club_id: number; session_date: string; session_time: string | null;
    game_title: string | null; opponent_name: string | null;
    booked_by_score: number | null; opponent_score: number | null;
    booked_by_army: string | null; opponent_army: string | null;
    result_mission: string | null; result_deployment: string | null;
    result_terrain: string | null; result_confirmation: string | null;
    booker: Person; opponent: Person; acceptor: Person;
  };

  const club = clubs.get(r.club_id);
  if (!club) return null;

  // Whoever took the table off a looking-for-game post sits in the opponent's
  // seat, same as everywhere else.
  const away = r.acceptor ?? r.opponent;

  return {
    id: r.id,
    club,
    date: r.session_date,
    time: r.session_time,
    title: r.game_title || "Table booking",
    homeName: nameOf(r.booker, "A member"),
    awayName: nameOf(away, r.opponent_name?.trim() || "an opponent"),
    homeScore: r.booked_by_score,
    awayScore: r.opponent_score,
    homeArmy: r.booked_by_army ?? "",
    awayArmy: r.opponent_army ?? "",
    mission: (r.result_mission ?? "").trim(),
    deployment: (r.result_deployment ?? "").trim(),
    terrain: (r.result_terrain ?? "").trim(),
    confirmation: toConfirmation(r.result_confirmation) as ConfirmationState,
    locked: isLocked(r.result_confirmation),
    recorded: r.booked_by_score !== null,
  };
}

async function ownedRefs(profileId: string): Promise<OwnerClubRef[]> {
  const clubs = await findOwnedClubs(profileId).catch(() => []);
  return clubs.map((c) => ({ id: c.id, slug: c.slug, name: c.name }));
}

/** Everything played at a person's clubs, sorted into what needs doing. */
export async function getScoreQueue(profileId: string): Promise<ScoreQueue> {
  const clubs = await ownedRefs(profileId);
  if (!clubs.length) {
    return { clubs, pending: [], contested: [], unscored: [], settled: [] };
  }

  const rows = await repo.findPlayedBookingsForClubs(
    clubs.map((c) => c.id), londonToday());
  const byId = new Map(clubs.map((c) => [c.id, c]));
  const all = rows.map((row) => toResult(row, byId)).filter(Boolean) as OwnerResult[];

  return {
    clubs,
    unscored: all.filter((r) => !r.recorded),
    contested: all.filter((r) => r.recorded && r.confirmation === "disputed"),
    pending: all.filter((r) =>
      r.recorded && (r.confirmation === "submitted" || r.confirmation === "confirmed")),
    settled: all.filter((r) => r.recorded && r.confirmation === "admin-confirmed").slice(0, 24),
  };
}

/**
 * Merchandise orders across every club a person owns.
 *
 * The club shop page answers "what has been ordered here". Somebody running
 * four clubs asking "is anybody waiting on me for kit" had to open four shops.
 */
export async function getOwnedOrders(profileId: string): Promise<OwnerOrder[]> {
  const clubs = await ownedRefs(profileId);
  if (!clubs.length) return [];

  const lists = await Promise.all(clubs.map(async (club) => {
    // One club failing to load should cost that club, not the whole page.
    const orders = await getOrders(club.id).catch(() => []);
    return orders.map((order) => ({ ...order, club }));
  }));

  return lists.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Tables still to come across every club a person owns. */
export async function getOwnedBookings(profileId: string): Promise<OwnerResult[]> {
  const clubs = await ownedRefs(profileId);
  if (!clubs.length) return [];

  const rows = await repo.findUpcomingBookingsForClubs(
    clubs.map((c) => c.id), londonToday());
  const byId = new Map(clubs.map((c) => [c.id, c]));
  return rows.map((row) => toResult(row, byId)).filter(Boolean) as OwnerResult[];
}
