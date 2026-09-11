import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Read-backs for confirmation emails.
 *
 * Every one of these is priced in the database — the discount, the points and
 * the stock all move under a lock inside a definer function — so the only
 * honest way to tell a member what they just bought is to read the row back
 * rather than repeat what the form sent.
 */

type Club = { name: string; slug: string } | null;

export type OrderReceipt = {
  id: number;
  profile_id: string;
  total: number;
  loyalty_points_spent: number;
  club_merchandise_order_items: { name: string; quantity: number; price: string | null; line_total: number }[];
  clubs: Club;
};

export type CoachingReceipt = {
  id: number;
  profile_id: string;
  club_coaching_slots: {
    title: string; slot_date: string; start_time: string; end_time: string | null;
    price: string | null; coaching_type: string; clubs: Club;
  } | null;
};

export type BookingReceipt = {
  id: number;
  booked_by: string;
  table_index: number;
  session_date: string;
  game_title: string;
  opponent_name: string | null;
  total_price: number;
  price_currency: string;
  loyalty_points_spent: number;
  session_time: string | null;
  clubs: Club;
};

/**
 * One receipt row, by id.
 *
 * Each of the three is written out rather than sharing a helper that takes the
 * table as a string: a runtime table name cannot be typed, and these carry the
 * embeds an email is built from. A receipt that cannot be read is a missing
 * email, never a failed order, so the caller decides what to do about null.
 */
export async function findOrderReceipt(orderId: number): Promise<OrderReceipt | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_merchandise_orders")
    .select(`id, profile_id, total, loyalty_points_spent,
             club_merchandise_order_items(name, quantity, price, line_total),
             clubs(name, slug)`)
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as OrderReceipt | null) ?? null;
}

export async function findCoachingReceipt(bookingId: number): Promise<CoachingReceipt | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_coaching_bookings")
    .select(`id, profile_id,
             club_coaching_slots(title, slot_date, start_time, end_time, price,
                                 coaching_type, clubs(name, slug))`)
    .eq("id", bookingId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as CoachingReceipt | null) ?? null;
}

export async function findBookingReceipt(bookingId: number): Promise<BookingReceipt | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_bookings")
    .select(`id, booked_by, table_index, session_date, game_title, opponent_name,
             total_price, price_currency, loyalty_points_spent,
             session_time, clubs(name, slug)`)
    .eq("id", bookingId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as BookingReceipt | null) ?? null;
}
