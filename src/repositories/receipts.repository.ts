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
 * `src/types/database.ts` predates 0038 and 0043 and carries no relationships,
 * so the embeds and `loyalty_points_spent` are unknown to it. Same temporary
 * narrowing as competitions; delete once the types are regenerated.
 */
type One<T> = { data: T | null; error: { message: string } | null };
type Reader = {
  select(columns: string): { eq(column: string, value: number): { maybeSingle(): Promise<One<unknown>> } };
};

async function readOne<T>(table: string, columns: string, id: number): Promise<T | null> {
  const supabase = await createClient();
  const from = (supabase.from as unknown as (name: string) => Reader)(table);
  const { data, error } = await from.select(columns).eq("id", id).maybeSingle();
  // A receipt that cannot be read is a missing email, never a failed order.
  if (error) throw new Error(error.message);
  return (data as T) ?? null;
}

export function findOrderReceipt(orderId: number) {
  return readOne<OrderReceipt>(
    "club_merchandise_orders",
    `id, profile_id, total, loyalty_points_spent,
     club_merchandise_order_items(name, quantity, price, line_total),
     clubs(name, slug)`,
    orderId,
  );
}

export function findCoachingReceipt(bookingId: number) {
  return readOne<CoachingReceipt>(
    "club_coaching_bookings",
    `id, profile_id, club_coaching_slots(title, slot_date, start_time, end_time, price, coaching_type,
                             clubs(name, slug))`,
    bookingId,
  );
}

export function findBookingReceipt(bookingId: number) {
  return readOne<BookingReceipt>(
    "club_bookings",
    `id, booked_by, table_index, session_date, game_title, opponent_name,
     total_price, price_currency, loyalty_points_spent,
     session_time, clubs(name, slug)`,
    bookingId,
  );
}
