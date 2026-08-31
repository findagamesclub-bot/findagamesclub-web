import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * The member's own coaching and kit, across every club.
 *
 * Both already exist per club; what was missing is the member's view of them
 * in one place. RLS already limits these tables to the person and their club,
 * so no privileged client is involved.
 */
export async function findMyCoaching(profileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_coaching_bookings")
    .select(
      `id, status, payment_status, booked_at, paid_at, cancelled_at,
       club_coaching_slots!inner(
         id, title, description, slot_date, start_time, end_time, price,
         coaching_type, capacity,
         clubs!inner(slug, name, logo_url)
       )`,
    )
    .eq("profile_id", profileId)
    .order("booked_at", { ascending: false });

  if (error) throw new Error(`Failed to load your coaching: ${error.message}`);
  return data ?? [];
}

export async function findMyOrders(profileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_merchandise_orders")
    .select(
      `id, status, created_at, status_updated_at, subtotal, total,
       tier_discount_amount, loyalty_discount, membership_tier_label, notes,
       clubs!inner(slug, name, logo_url),
       club_merchandise_order_items(id, name, price, quantity, line_total)`,
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
       clubs!inner(slug, name, logo_url),
       club_coaching_bookings(id, profile_id, status)`,
    )
    .in("club_id", clubIds)
    .eq("status", "open")
    .gte("slot_date", fromDate)
    .order("slot_date", { ascending: true });

  if (error) throw new Error(`Failed to load coaching slots: ${error.message}`);
  return data ?? [];
}
