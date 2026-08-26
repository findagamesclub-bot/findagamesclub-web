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
