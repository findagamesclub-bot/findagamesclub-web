import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * The member's own coaching and kit, across every club.
 *
 * Both already exist per club; what was missing is the member's view of them
 * in one place. RLS already limits these tables to the person and their club,
 * so no privileged client is involved.
 */
export type MyCoachingRow = {
  booking_id: number;
  slot_id: number;
  title: string;
  description: string;
  slot_date: string;
  start_time: string | null;
  end_time: string | null;
  price: string | null;
  coaching_type: string | null;
  capacity: number | null;
  club_slug: string;
  club_name: string;
  club_logo_url: string | null;
  club_logo_path: string | null;
  status: string;
  payment_status: string;
  refund_status: string | null;
  cancel_reason: string | null;
  base_price: number | string | null;
  price_currency: string | null;
  tier_label: string | null;
  tier_percent: number | null;
  tier_amount: number | string | null;
  points_spent: number | null;
  points_amount: number | string | null;
  total_price: number | string | null;
  booked_at: string;
};

/**
 * A member's coaching, with what each session actually came to.
 *
 * Through 0178's function rather than a select, because `database.ts` has
 * never carried 0157's seven money columns and `check:columns` is right to
 * refuse a query naming them. Same shape the club's own list has used since
 * 0158, and the function is `security invoker` so the table's policy still
 * decides what comes back.
 */
export async function findMyCoaching(): Promise<MyCoachingRow[]> {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as {
    rpc(n: string, a: Record<string, unknown>): Promise<{
      data: unknown; error: { message: string } | null;
    }>;
  }).rpc("my_coaching_bookings", {});

  if (error) throw new Error(`Failed to load your coaching: ${error.message}`);
  return (data as MyCoachingRow[]) ?? [];
}

export async function findMyOrders(profileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_merchandise_orders")
    .select(
      `id, status, created_at, status_updated_at, subtotal, total,
       tier_discount_percent, tier_discount_amount, loyalty_points_spent,
       loyalty_discount, membership_tier_label, notes,
       clubs!inner(slug, name, logo_url, logo_path),
       club_merchandise_order_items(id, name, variant_label, price, quantity,
                                    unit_amount, line_total)`,
    )
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load your orders: ${error.message}`);
  return data ?? [];
}

/**
 * Coaching slots with places left, at clubs the viewer belongs to.
 *
 * Only future, open slots. The bookings come with them so a slot the member is
 * already on, and a slot that has filled up, can both be dropped without a
 * second round trip.
 */
export async function findOpenSlots(clubIds: number[], fromDate: string) {
  if (!clubIds.length) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_coaching_slots")
    .select(
      `id, title, description, slot_date, start_time, end_time, price,
       coaching_type, capacity,
       clubs!inner(slug, name, logo_url, logo_path),
       club_coaching_bookings(id, profile_id, status)`,
    )
    .in("club_id", clubIds)
    .eq("status", "open")
    .gte("slot_date", fromDate)
    .order("slot_date", { ascending: true });

  if (error) throw new Error(`Failed to load coaching slots: ${error.message}`);
  return data ?? [];
}
