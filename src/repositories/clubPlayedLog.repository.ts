import "server-only";

import { callRpc } from "@/lib/supabase/table";
import type { PlayedSort, PlayedTab } from "@/utils/played-log";

/**
 * Games that have already happened at one club.
 *
 * Through 0213's function rather than a select, and for a reason that is not
 * about the generated types this time: `club_bookings_select` (0014) shows a
 * club member only FUTURE bookings of other people, so a member reading this
 * through RLS would see their own history and nothing of the night they were
 * part of. 0056 drew the same line for one member's record.
 *
 * Nothing about money comes back. That is `bookings.manage`'s question and it
 * has its own screen.
 */

export type PlayedLogRpcRow = {
  booking_id: number;
  session_date: string;
  session_time: string | null;
  session_label: string | null;
  table_index: number;
  game_title: string | null;
  home_id: string | null;
  home_name: string | null;
  away_id: string | null;
  away_name: string | null;
  /** `numeric(6,1)` in the table, so it arrives over PostgREST as a string. */
  home_score: number | string | null;
  away_score: number | string | null;
  home_army: string | null;
  away_army: string | null;
  mission: string | null;
  deployment: string | null;
  terrain: string | null;
  confirmation: string | null;
  recorded: boolean;
  total_rows: number | string | null;
};

export type PlayedLogFilters = {
  tab: PlayedTab;
  month: string;
  game: string;
  member: string;
  query: string;
  sort: PlayedSort;
  page: number;
  per: number;
};

export function findPlayedLog(clubId: number, filters: PlayedLogFilters) {
  return callRpc<PlayedLogRpcRow[] | null>("club_played_log", {
    p_club: clubId,
    p_state: filters.tab,
    p_month: filters.month,
    p_game: filters.game,
    p_member: filters.member,
    p_query: filters.query,
    p_sort: filters.sort,
    p_page: filters.page,
    p_per: filters.per,
  });
}

export type PlayedLogCountsRow = {
  all_rows: number | string;
  unscored: number | string;
  waiting: number | string;
  disputed: number | string;
  settled: number | string;
};

export function findPlayedLogCounts(
  clubId: number,
  filters: { month: string; game: string; member: string; query: string },
) {
  return callRpc<PlayedLogCountsRow[] | PlayedLogCountsRow | null>(
    "club_played_log_counts", {
      p_club: clubId,
      p_month: filters.month,
      p_game: filters.game,
      p_member: filters.member,
      p_query: filters.query,
    });
}

export type PlayedMonthRow = {
  month: string;
  ruled: number | string;
  waiting: number | string;
  unscored: number | string;
};

/** The trend, counted across every month rather than across one page. */
export function findPlayedMonths(clubId: number) {
  return callRpc<PlayedMonthRow[] | null>("club_played_months", { p_club: clubId });
}
