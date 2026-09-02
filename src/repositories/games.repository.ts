import "server-only";

import { createClient } from "@/lib/supabase/server";

export type GameRow = {
  id: number;
  club_id: number;
  session_date: string;
  session_time: string | null;
  game_title: string | null;
  status: string;
  booked_by: string;
  opponent_profile_id: string | null;
  opponent_name: string;
  booked_by_score: number | null;
  opponent_score: number | null;
  booked_by_army: string;
  opponent_army: string;
  result_at: string | null;
  result_mission: string | null;
  result_deployment: string | null;
  result_terrain: string | null;
  result_confirmation: string | null;
  clubs: { slug: string; name: string; logo_url: string | null };
  booker: { full_name: string | null } | null;
  opponent: { full_name: string | null } | null;
};

export type HeadToHeadRow = {
  opponent_id: string;
  opponent_name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  last_played: string | null;
};

/**
 * `src/types/database.ts` does not know the result columns until 0030 is
 * applied and the types are regenerated. Same temporary narrowing as
 * elsewhere; delete this block then.
 */
type Result<T> = { data: T | null; error: { message: string } | null };
type ListChain = {
  eq(column: string, value: string | number): ListChain;
  order(column: string, options: { ascending: boolean }): ListChain;
  range(from: number, to: number): Promise<Result<GameRow[]>>;
};
type Root = { select(columns: string): ListChain };

const COLUMNS = `
  id, club_id, session_date, session_time, game_title, status,
  booked_by, opponent_profile_id, opponent_name,
  booked_by_score, opponent_score, booked_by_army, opponent_army, result_at,
  result_mission, result_deployment, result_terrain, result_confirmation,
  clubs!inner(slug, name, logo_url),
  booker:profiles!club_bookings_booked_by_fkey(full_name),
  opponent:profiles!club_bookings_opponent_profile_id_fkey(full_name)`;

/**
 * Games this person was on, newest first.
 *
 * Joined through club_booking_participants rather than an OR across two
 * columns: that table already holds one row per person per booking and is
 * indexed on (profile_id, session_date desc), so this reads one person's
 * games however many the club has.
 */
export async function findMyGames(profileId: string, from: number, to: number) {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as { from(name: string): Root })
    .from("club_booking_participants")
    .select(`booking_id, session_date, club_bookings!inner(${COLUMNS})`)
    .eq("profile_id", profileId)
    .order("session_date", { ascending: false })
    .range(from, to);

  if (error) throw new Error(`Failed to load your games: ${error.message}`);
  return (data ?? []) as unknown as { club_bookings: GameRow }[];
}

/** Wins, draws and losses per opponent, counted in the database. */
export async function findHeadToHead() {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as {
    rpc(name: string): Promise<{ data: HeadToHeadRow[] | null; error: { message: string } | null }>;
  }).rpc("head_to_head");

  if (error) throw new Error(`Failed to load your record: ${error.message}`);
  return data ?? [];
}

export async function saveResult(params: {
  bookingId: number;
  bookedByScore: number;
  opponentScore: number;
  bookedByArmy: string;
  opponentArmy: string;
  mission: string;
  deployment: string;
  terrain: string;
  /** Only honoured for somebody who can manage the club. */
  confirmation: string;
}) {
  const supabase = await createClient();
  const { error } = await (supabase as unknown as {
    rpc(name: string, args: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
  }).rpc("record_booking_result", {
    p_booking: params.bookingId,
    p_booked_by_score: params.bookedByScore,
    p_opponent_score: params.opponentScore,
    p_booked_by_army: params.bookedByArmy,
    p_opponent_army: params.opponentArmy,
    p_mission: params.mission,
    p_deployment: params.deployment,
    p_terrain: params.terrain,
    // Ignored by the function for anyone who cannot manage the club, which is
    // where the rule belongs. Sent anyway so the club's choice reaches it.
    p_confirmation: params.confirmation,
  });

  if (error) throw new Error(error.message);
}

export async function clearResult(bookingId: number) {
  const supabase = await createClient();
  const { error } = await (supabase as unknown as {
    rpc(name: string, args: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
  }).rpc("clear_booking_result", { p_booking: bookingId });

  if (error) throw new Error(error.message);
}

export type RivalryRow = {
  member_one: string;
  member_one_name: string;
  member_two: string;
  member_two_name: string;
  played: number;
  wins_one: number;
  wins_two: number;
  draws: number;
  last_played: string | null;
  /** Added by 0054: what each of them has scored across the rivalry. */
  score_one: number;
  score_two: number;
  /** How many of the pair named the other. Two is mutual. */
  nominations: number;
  mutual: boolean;
};

export type RivalryMatchRow = {
  booking_id: number;
  /** "booking" or "competition". Legacy counts both towards a rivalry. */
  source: string;
  session_date: string | null;
  game_title: string;
  competition: string;
  /** Always from the first member's side, whichever seat they were in. */
  score_one: number;
  score_two: number;
};

export type RivalryUpcomingRow = {
  booking_id: number;
  session_date: string;
  session_time: string;
  session_label: string;
  game_title: string;
  booked_by_name: string;
  notes: string;
};

/** Every scored game between two members, for the head-to-head page. */
export async function findRivalryMatches(clubId: number, one: string, two: string) {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as {
    rpc(name: string, args: Record<string, unknown>): Promise<{
      data: RivalryMatchRow[] | null; error: { message: string } | null;
    }>;
  }).rpc("club_rivalry_matches", { p_club: clubId, p_one: one, p_two: two });

  if (error) throw new Error(`Failed to load that rivalry: ${error.message}`);
  return data ?? [];
}

/** The pair's booked meetings that have not been played yet. */
export async function findRivalryUpcoming(clubId: number, one: string, two: string) {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as {
    rpc(name: string, args: Record<string, unknown>): Promise<{
      data: RivalryUpcomingRow[] | null; error: { message: string } | null;
    }>;
  }).rpc("club_rivalry_upcoming", { p_club: clubId, p_one: one, p_two: two });

  if (error) throw new Error(`Failed to load upcoming meetings: ${error.message}`);
  return data ?? [];
}

/**
 * Every pair at one club who have played a scored game.
 *
 * Counted in the database: a club with a thousand members has half a million
 * possible pairs, and only the ones who have played exist as rows.
 */
export async function findClubRivalries(clubId: number) {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as {
    rpc(name: string, args: Record<string, unknown>): Promise<{
      data: RivalryRow[] | null; error: { message: string } | null;
    }>;
  }).rpc("club_rivalries", { p_club: clubId });

  if (error) throw new Error(`Failed to load rivalries: ${error.message}`);
  return data ?? [];
}

export type FormRow = {
  member_id: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
};

/** Each member's record at one club, counted in the database. */
export async function findClubForm(clubId: number) {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as {
    rpc(name: string, args: Record<string, unknown>): Promise<{
      data: FormRow[] | null; error: { message: string } | null;
    }>;
  }).rpc("club_member_form", { p_club: clubId });

  if (error) throw new Error(`Failed to load form: ${error.message}`);
  return data ?? [];
}

export type MemberGameRow = {
  ref_id: number;
  source: string;
  played_on: string | null;
  game_title: string;
  competition: string;
  opponent_id: string | null;
  opponent_name: string;
  my_score: number;
  their_score: number;
};

/**
 * One member's scored games at one club, newest first.
 *
 * Not a plain select: club_bookings_select shows a member only FUTURE bookings
 * of other people, so somebody else's history is invisible through RLS by
 * design. 0056 reads past it behind the same members-only guard.
 */
export async function findMemberGames(clubId: number, memberId: string) {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as {
    rpc(name: string, args: Record<string, unknown>): Promise<{
      data: MemberGameRow[] | null; error: { message: string } | null;
    }>;
  }).rpc("club_member_games", { p_club: clubId, p_member: memberId });

  if (error) throw new Error(`Failed to load their record: ${error.message}`);
  return data ?? [];
}
