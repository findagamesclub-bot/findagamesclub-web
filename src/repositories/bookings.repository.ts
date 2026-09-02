import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/types/database";

const BOOKING_COLUMNS =
  "id, club_id, club_session_id, session_date, session_day, session_time, session_label, " +
  "table_index, game_title, notes, booked_by, opponent_profile_id, opponent_name, " +
  "accepted_by, source, status, total_price, base_price, tier_discount_percent, " +
  "price_currency, membership_tier_label, created_at";

/** Active bookings for a club across a date window, with the people on them. */
export async function findBookings(clubId: number, fromDate: string, toDate: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_bookings")
    .select(
      `${BOOKING_COLUMNS},
       booker:profiles!club_bookings_booked_by_fkey(id, full_name),
       opponent:profiles!club_bookings_opponent_profile_id_fkey(id, full_name),
       acceptor:profiles!club_bookings_accepted_by_fkey(id, full_name)`,
    )
    .eq("club_id", clubId)
    .eq("status", "booked")
    .gte("session_date", fromDate)
    .lte("session_date", toDate)
    .order("session_date")
    .order("table_index");

  if (error) throw new Error(`Failed to load bookings: ${error.message}`);
  return data ?? [];
}

/**
 * How many future bookings one person holds at a club.
 *
 * Counts participation, not authorship: legacy's cap counts you whether you
 * booked, accepted, or were named as somebody's opponent (club_store.py:14444).
 */
export async function countUpcomingFor(clubId: number, profileId: string, fromDate: string) {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("club_booking_participants")
    .select("booking_id", { count: "exact", head: true })
    .eq("club_id", clubId)
    .eq("profile_id", profileId)
    .gte("session_date", fromDate);

  if (error) throw new Error(`Failed to count bookings: ${error.message}`);
  return count ?? 0;
}

/**
 * The viewer's own table bookings across every club, soonest first.
 *
 * Cross-club rather than per club: a member with three clubs wants one answer
 * to "where am I playing this week", not three pages to check.
 */
export async function findMyUpcoming(profileId: string, fromDate: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_bookings")
    .select(`${BOOKING_COLUMNS}, clubs!inner(slug, name, logo_url)`)
    .eq("booked_by", profileId)
    .gte("session_date", fromDate)
    .neq("status", "cancelled")
    .order("session_date", { ascending: true });

  if (error) throw new Error(`Failed to load your bookings: ${error.message}`);
  return data ?? [];
}

export async function insertBooking(row: TablesInsert<"club_bookings">) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_bookings")
    .insert(row)
    // Written out rather than using the shared constant: PostgREST infers the
    // row type from the literal, and a variable collapses it to an error type.
    .select("id, table_index, session_date, club_session_id, booked_by, total_price, price_currency, tier_discount_percent")
    .maybeSingle();

  // Errors here are meaningful and the service maps them to copy, so the raw
  // Postgres code has to survive. 23505 is a seat race worth retrying.
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  if (!data) throw new Error("NOT_PERMITTED");
  return data;
}

/** Cancel. The policy decides who may; the trigger stamps who did. */
export async function cancelBooking(id: number, reason: string | null) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_bookings")
    .update({ status: "cancelled", cancel_reason: reason })
    .eq("id", id)
    .eq("status", "booked")
    .select("id, club_id, session_date, club_session_id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  // Zero rows means RLS filtered it out — see the trap in CLAUDE.md.
  if (!data) throw new Error("NOT_PERMITTED");
  return data;
}

/** The club's schedule, in the order the club arranged it. */
export async function findSchedule(clubId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_sessions")
    .select("id, day, time, label, position")
    .eq("club_id", clubId)
    .order("position");

  if (error) throw new Error(`Failed to load schedule: ${error.message}`);
  return data ?? [];
}

/** Booking configuration. A missing row means the club takes no bookings. */
/**
 * What this member's tier takes off a table, straight from the function the
 * insert trigger uses. Reading the benefits here instead would be a second
 * copy of a rule that already handles waiveGameBookingFee.
 */
/**
 * Games already played at this club, newest first.
 *
 * For the club, not for a player: every booking, not just the ones the viewer
 * was in. Without it a manager can only settle a result on a game they happened
 * to play, and a dispute between two other members has no way out.
 */
export type PlayedBookingRow = {
  id: number;
  session_date: string;
  session_time: string | null;
  game_title: string | null;
  opponent_name: string | null;
  booked_by_score: number | null;
  opponent_score: number | null;
  booked_by_army: string | null;
  opponent_army: string | null;
  result_mission: string | null;
  result_deployment: string | null;
  result_terrain: string | null;
  result_confirmation: string | null;
};

export async function findPlayedBookings(clubId: number, before: string, limit = 40) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_bookings")
    // `*` because the result columns arrived in 0030 and 0044 and the generated
    // types predate them. Delete the cast below once they are regenerated.
    .select(
      `*,
       booker:profiles!club_bookings_booked_by_fkey(id, full_name),
       opponent:profiles!club_bookings_opponent_profile_id_fkey(id, full_name),
       acceptor:profiles!club_bookings_accepted_by_fkey(id, full_name)`,
    )
    .eq("club_id", clubId)
    .eq("status", "booked")
    .lte("session_date", before)
    .order("session_date", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load played games: ${error.message}`);
  return (data ?? []) as unknown as PlayedBookingRow[];
}

/**
 * Played games across several clubs at once, for an owner who runs more than
 * one. The per-club version answers "what happened here"; this answers "what is
 * waiting on me", which is a different question and the one legacy puts in its
 * Score Approvals section.
 */
export async function findPlayedBookingsForClubs(
  clubIds: number[], before: string, limit = 200,
) {
  if (!clubIds.length) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_bookings")
    .select(
      `*,
       clubs!inner(id, slug, name, logo_url),
       booker:profiles!club_bookings_booked_by_fkey(id, full_name),
       opponent:profiles!club_bookings_opponent_profile_id_fkey(id, full_name),
       acceptor:profiles!club_bookings_accepted_by_fkey(id, full_name)`,
    )
    .in("club_id", clubIds)
    .eq("status", "booked")
    .lte("session_date", before)
    .order("session_date", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load played games: ${error.message}`);
  return (data ?? []) as unknown as (PlayedBookingRow & { club_id: number })[];
}

/** Tables still to come across several clubs, newest night first. */
export async function findUpcomingBookingsForClubs(
  clubIds: number[], fromDate: string, limit = 200,
) {
  if (!clubIds.length) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_bookings")
    .select(
      `*,
       clubs!inner(id, slug, name, logo_url),
       booker:profiles!club_bookings_booked_by_fkey(id, full_name),
       opponent:profiles!club_bookings_opponent_profile_id_fkey(id, full_name),
       acceptor:profiles!club_bookings_accepted_by_fkey(id, full_name)`,
    )
    .in("club_id", clubIds)
    .eq("status", "booked")
    .gte("session_date", fromDate)
    .order("session_date")
    .limit(limit);

  if (error) throw new Error(`Failed to load bookings: ${error.message}`);
  return (data ?? []) as unknown as (PlayedBookingRow & { club_id: number })[];
}

export async function findBookingDiscountPercent(clubId: number, profileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("booking_discount_percent", {
    target_club: clubId,
    target_profile: profileId,
  });

  if (error) throw new Error(`Failed to read the booking discount: ${error.message}`);
  return Number(data ?? 0);
}

export async function findBookingSettings(clubId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_booking_settings")
    .select("*")
    .eq("club_id", clubId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load booking settings: ${error.message}`);
  return data;
}

/** The six per-club membership settings, from 0008. */
export async function findMembershipSettings(clubId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_membership_settings")
    .select("*")
    .eq("club_id", clubId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load membership settings: ${error.message}`);
  return data;
}

/**
 * Entries promoted off a session's queue in the last minute.
 *
 * Promotion happens inside a database trigger when a booking is cancelled, so
 * nothing in the application knows it occurred. This is how the cancelling
 * request finds out that somebody else now has a table, and needs telling.
 */
export async function findJustPromoted(clubSessionId: number, sessionDate: string) {
  const supabase = await createClient();
  const since = new Date(Date.now() - 60_000).toISOString();

  const { data, error } = await supabase
    .from("club_booking_waitlist")
    .select(`id, requested_by, booking_id, game_title, session_date, promoted_at,
             club_bookings!club_booking_waitlist_booking_id_fkey(session_time, total_price, price_currency)`)
    .eq("club_session_id", clubSessionId)
    .eq("session_date", sessionDate)
    .eq("status", "promoted")
    .gte("promoted_at", since);

  if (error) throw new Error(`Failed to check promotions: ${error.message}`);
  return data ?? [];
}

/** Is this person already on a booking that night? */
export async function isPlayingOn(clubId: number, profileId: string, sessionDate: string) {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("club_booking_participants")
    .select("booking_id", { count: "exact", head: true })
    .eq("club_id", clubId)
    .eq("profile_id", profileId)
    .eq("session_date", sessionDate);

  if (error) throw new Error(`Failed to check that night: ${error.message}`);
  return (count ?? 0) > 0;
}

/**
 * Correct what is written on a booking.
 *
 * A function rather than an update: 0014 grants `authenticated` update on
 * `status` and `cancel_reason` only, and widening that to reach three text
 * columns would hand out the row.
 */
export async function editBookingDetails(params: {
  bookingId: number;
  gameTitle: string;
  opponentName: string;
  notes: string;
}) {
  const supabase = await createClient();
  const { error } = await (supabase as unknown as {
    rpc(name: string, args: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
  }).rpc("edit_booking_details", {
    p_booking: params.bookingId,
    p_game_title: params.gameTitle,
    p_opponent_name: params.opponentName,
    p_notes: params.notes,
  });

  if (error) throw new Error(error.message);
}
