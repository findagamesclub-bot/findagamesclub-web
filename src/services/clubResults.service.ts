import { getArmyContext, type Builder, type ResultArmies }
  from "./resultArmies.service";
import "server-only";

import { findPlayedBookings } from "@/repositories/bookings.repository";
import { findClubBookingFacets } from "@/repositories/clubTableBookings.repository";
import * as log from "@/repositories/clubPlayedLog.repository";
import { londonToday } from "./bookingCalendar.service";
import {
  monthLabel, NO_FACETS, splitFacets, type BookingFacets,
} from "@/utils/booking-facets";
import { PER_PAGE } from "@/utils/paging";
import type { PlayedCounts, PlayedSort, PlayedTab } from "@/utils/played-log";
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
  /** As stored. Empty on a booking nobody named a game on; `title` carries
   *  the placeholder the card shows. */
  gameTitle: string;
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
  /** In the booking's own order: `one` is whoever booked. */
  armies: ResultArmies;
  /** Null when this club does not run the army builder. */
  builder: Builder | null;
};

type Person = { id: string; full_name: string | null } | null;
const nameOf = (p: Person, fallback: string) => p?.full_name?.trim() || fallback;

export async function getClubResults(clubId: number, limit = 40): Promise<ClubResult[]> {
  const rows = await findPlayedBookings(clubId, londonToday(), limit);

  // A second wave, once, rather than two more reads per game on the page.
  const army = await getArmyContext("booking",
    rows.filter((row) => row.booked_by_score !== null).map((row) => row.id),
    [clubId]);

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
      gameTitle: row.game_title || "",
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
      armies: army.sides(row.id),
      builder: army.builder(clubId),
    };
  });
}

/**
 * The club's log of played games, filtered, counted and paged in SQL.
 *
 * `getClubResults` above reads the newest forty and is what the console's
 * overview widget counts. This is the Scores page's own read, and it is a
 * different shape on purpose: a month filter over the newest forty answers
 * about the forty, which is the complaint this was built for.
 */
export type PlayedLogResult = {
  rows: ClubResult[];
  total: number;
  counts: PlayedCounts | null;
  facets: BookingFacets;
  months: { label: string; ruled: number; waiting: number; unscored: number }[];
  failed: boolean;
};

const whole = (value: number | string | null | undefined) => Number(value ?? 0);

export async function getPlayedLog(
  clubId: number,
  filters: {
    tab: PlayedTab; month: string; game: string; member: string;
    query: string; sort: PlayedSort; page: number;
  },
  /**
   * The trend is the club's own and asks `results.manage`. A member reading
   * the same nights would spend a round trip on a refusal and draw no chart
   * either way, so it is asked for rather than always fetched.
   */
  { trend = true }: { trend?: boolean } = {},
): Promise<PlayedLogResult> {
  // One wave of four. None needs another's answer, and each costs a round
  // trip of about 300ms whatever it asks for.
  const [listed, counted, facets, months] = await Promise.all([
    log.findPlayedLog(clubId, { ...filters, per: PER_PAGE.rows }).catch((error) => {
      console.error("[scores] the list did not load", error);
      return null;
    }),
    log.findPlayedLogCounts(clubId, filters).catch((error) => {
      console.error("[scores] the counts did not load", error);
      return null;
    }),
    // Only the nights that have been played, so a month the picker offers
    // and the list underneath it cannot disagree about what is in it.
    findClubBookingFacets(clubId, "played").catch((error) => {
      console.error("[scores] the filters did not load", error);
      return null;
    }),
    trend
      ? log.findPlayedMonths(clubId).catch((error) => {
          console.error("[scores] the trend did not load", error);
          return null;
        })
      : Promise.resolve(null),
  ]);

  const rows = listed ?? [];
  // A second wave, once, rather than two more reads per game on the page.
  // Only the scored ones: an army is recorded against a result, and a game
  // nobody has typed a score on has no row for one to hang off.
  const army = await getArmyContext("booking",
    rows.filter((row) => row.recorded).map((row) => row.booking_id), [clubId]);

  const raw = Array.isArray(counted) ? counted[0] : counted;

  return {
    rows: rows.map((row) => ({
      id: row.booking_id,
      date: row.session_date,
      time: row.session_time,
      title: row.game_title || "Table booking",
      gameTitle: row.game_title || "",
      homeName: row.home_name || "A member",
      awayName: row.away_name || "an opponent",
      // `numeric` arrives as a string and "20.0 – 10.0" is not a scoreline.
      homeScore: row.home_score === null ? null : Number(row.home_score),
      awayScore: row.away_score === null ? null : Number(row.away_score),
      homeArmy: row.home_army ?? "",
      awayArmy: row.away_army ?? "",
      mission: (row.mission ?? "").trim(),
      deployment: (row.deployment ?? "").trim(),
      terrain: (row.terrain ?? "").trim(),
      confirmation: toConfirmation(row.confirmation),
      locked: isLocked(row.confirmation),
      recorded: row.recorded,
      armies: army.sides(row.booking_id),
      builder: army.builder(clubId),
    })),
    // The window function returns the same figure on every row, so any row
    // will do and an empty page means an empty list.
    total: rows.length ? whole(rows[0]!.total_rows) : 0,
    counts: raw
      ? {
          all: whole(raw.all_rows),
          unscored: whole(raw.unscored),
          waiting: whole(raw.waiting),
          disputed: whole(raw.disputed),
          settled: whole(raw.settled),
        }
      : null,
    facets: facets ? splitFacets(facets) : NO_FACETS,
    months: (months ?? []).map((row) => ({
      label: monthLabel(row.month),
      ruled: whole(row.ruled),
      waiting: whole(row.waiting),
      unscored: whole(row.unscored),
    })),
    failed: listed === null,
  };
}
