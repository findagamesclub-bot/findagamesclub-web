import "server-only";

import { findPlayedBookings } from "@/repositories/bookings.repository";
import { londonToday } from "./bookingCalendar.service";
import { isLocked, toConfirmation, type ConfirmationState } from "@/utils/result-meta";

/**
 * Every game played at a club, as the club sees it.
 *
 * Not written from anybody's side: the account pages say "you" and "them"
 * because a player is reading them, and a club owner settling somebody else's
 * argument needs two names instead.
 */
export type ClubResult = {
  id: number;
  date: string;
  time: string | null;
  title: string;
  /** Whoever booked the table. Their score is the first of the pair. */
  homeName: string;
  awayName: string;
  homeScore: number | null;
  awayScore: number | null;
  homeArmy: string;
  awayArmy: string;
  mission: string;
  deployment: string;
  terrain: string;
  confirmation: ConfirmationState;
  locked: boolean;
  recorded: boolean;
};

type Person = { id: string; full_name: string | null } | null;
const nameOf = (p: Person, fallback: string) => p?.full_name?.trim() || fallback;

export async function getClubResults(clubId: number, limit = 40): Promise<ClubResult[]> {
  const rows = await findPlayedBookings(clubId, londonToday(), limit);

  return rows.map((row) => {
    const r = row as unknown as { booker: Person; opponent: Person; acceptor: Person };

    // Whoever took the table off a looking-for-game post sits in the opponent's
    // seat, same as everywhere else. A guest is a typed name and no account.
    const away = r.acceptor ?? r.opponent;

    return {
      id: row.id,
      date: row.session_date,
      time: row.session_time,
      title: row.game_title || "Table booking",
      homeName: nameOf(r.booker, "A member"),
      awayName: nameOf(away, row.opponent_name?.trim() || "an opponent"),
      homeScore: row.booked_by_score,
      awayScore: row.opponent_score,
      homeArmy: row.booked_by_army ?? "",
      awayArmy: row.opponent_army ?? "",
      mission: (row.result_mission ?? "").trim(),
      deployment: (row.result_deployment ?? "").trim(),
      terrain: (row.result_terrain ?? "").trim(),
      confirmation: toConfirmation(row.result_confirmation),
      locked: isLocked(row.result_confirmation),
      recorded: row.booked_by_score !== null,
    };
  });
}
