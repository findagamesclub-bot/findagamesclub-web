import "server-only";

import { createClient } from "@/lib/supabase/server";

/** Reading and cancelling bookings. The buying side is tickets.repository. */

const BOOKING_COLUMNS =
  "id, reference, event_id, club_id, full_name, email, status, currency, " +
  "subtotal, tier_discount_amount, total, created_at";

// The two loyalty columns 0050 adds are deliberately not selected yet:
// `src/types/database.ts` predates the migration, and PostgREST types the
// select from the literal, so naming them turns three well-typed queries into
// error types. Add them here, and the email line below, once the types are
// regenerated.

/** One booking with its lines and enough of the event to name it. */
export async function findBooking(reference: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_event_bookings")
    .select(
      `${BOOKING_COLUMNS},
       club_event_booking_items(ticket_type_id, label, price, unit_amount, quantity),
       club_events!inner(id, legacy_id, title, start_date,
                         clubs!inner(slug, name))`,
    )
    .eq("reference", reference)
    .maybeSingle();

  if (error) throw new Error(`Failed to load that booking: ${error.message}`);
  return data;
}

/** Everything the viewer has booked, newest first. */
export async function findMyBookings(profileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_event_bookings")
    .select(
      `${BOOKING_COLUMNS},
       club_event_booking_items(ticket_type_id, label, price, unit_amount, quantity),
       club_events!inner(id, legacy_id, title, start_date,
                         clubs!inner(slug, name))`,
    )
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load your bookings: ${error.message}`);
  return data ?? [];
}

/** Who is coming, for the club. */
export async function findAttendees(eventId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_event_bookings")
    .select(`${BOOKING_COLUMNS}, club_event_booking_items(label, quantity)`)
    .eq("event_id", eventId)
    .eq("status", "reserved")
    .order("created_at");

  if (error) throw new Error(`Failed to load attendees: ${error.message}`);
  return data ?? [];
}

/** Cancel. Policy decides who may; the trigger stamps who did. */
export async function cancelBooking(id: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_event_bookings")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("status", "reserved")
    .select("id, reference")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_PERMITTED");
  return data;
}

/**
 * The viewer's live bookings for this event. Holding one gates the info board.
 *
 * Plural, and deliberately not `maybeSingle`: nothing stops somebody checking
 * out twice for the same event — buying two more tickets a week later is an
 * ordinary thing to do — and `maybeSingle` turns that into a 500 on the event
 * page rather than an answer.
 */
export async function findMyBookingsForEvent(eventId: number, profileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_event_bookings")
    .select("id, reference, created_at")
    .eq("event_id", eventId)
    .eq("profile_id", profileId)
    .eq("status", "reserved")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to check your tickets: ${error.message}`);
  return data ?? [];
}

/**
 * How each of a club's events is selling, keyed by event id.
 *
 * One query for the whole club rather than one per event: an owner looking at
 * a season of twenty events would otherwise fire twenty round trips to draw
 * twenty small numbers.
 */
export async function findBookingCountsByClub(clubIds: number[]) {
  if (!clubIds.length) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_event_bookings")
    .select("event_id, total, club_event_booking_items(quantity)")
    .in("club_id", clubIds)
    .eq("status", "reserved");

  if (error) throw new Error(`Failed to count bookings: ${error.message}`);
  return data ?? [];
}
