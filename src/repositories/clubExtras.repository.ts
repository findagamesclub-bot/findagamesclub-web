import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Rivalries, merchandise and coaching.
 *
 * One repository because all three are small, club-scoped and read the same
 * way. Splitting them would be three files of twenty lines each.
 */

// --- rivalries -------------------------------------------------------------

export async function findRivals(clubId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_rivals")
    .select("id, profile_id, rival_id, created_at")
    .eq("club_id", clubId);

  if (error) throw new Error(`Failed to load rivalries: ${error.message}`);
  return data ?? [];
}

export async function addRival(clubId: number, rivalId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("club_rivals").insert({ club_id: clubId, rival_id: rivalId });
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
}

export async function dropRival(rivalRowId: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("club_rivals").delete().eq("id", rivalRowId);
  if (error) throw new Error(error.message);
}

// --- merchandise -----------------------------------------------------------

export async function findMerchandise(clubId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_merchandise_items")
    .select("id, legacy_id, name, category, description, image_src, image_alt, price, stock, minimum_tier_key, active, position")
    .eq("club_id", clubId)
    .order("position");

  if (error) throw new Error(`Failed to load the club shop: ${error.message}`);
  return data ?? [];
}

export async function findOrders(clubId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_merchandise_orders")
    .select(
      `id, profile_id, status, notes, membership_tier_label, created_at, status_updated_at,
       subtotal, tier_discount_percent, tier_discount_amount,
       loyalty_points_spent, loyalty_discount, total,
       club_merchandise_order_items(id, item_id, name, price, quantity,
                                    unit_amount, discount_amount, line_total),
       club_merchandise_order_notes(id, body, automatic, created_at,
                                    profiles(id, full_name)),
       profiles!inner(id, full_name)`,
    )
    .eq("club_id", clubId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load orders: ${error.message}`);
  return data ?? [];
}

/**
 * Ordering runs through a definer function.
 *
 * Stock has to be checked and decremented under a lock or two people ordering
 * the last shirt both get it, and the tier discount and points redemption must
 * be computed from the club's settings rather than sent by the browser.
 */
export async function placeOrder(params: {
  itemId: number;
  quantity: number;
  notes: string;
  redeemPoints: number;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_merchandise_order", {
    target_item: params.itemId,
    want: params.quantity,
    note: params.notes,
    redeem: params.redeemPoints,
  });

  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return { id: data as number };
}

export async function setOrderStatus(orderId: number, status: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_merchandise_orders")
    .update({ status, status_updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_PERMITTED");
}

/** One more line on an order's log. Notes are added, never replaced. */
export async function addOrderNote(orderId: number, authorId: string, body: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("club_merchandise_order_notes")
    .insert({ order_id: orderId, author_id: authorId, body });

  if (error) throw Object.assign(new Error(error.message), { code: error.code });
}

// --- coaching --------------------------------------------------------------

export async function findCoachingSettings(clubId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_coaching_settings")
    .select("club_id, enabled, intro_text, policy_text")
    .eq("club_id", clubId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load coaching: ${error.message}`);
  return data;
}

export async function findSlots(clubId: number, from: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_coaching_slots")
    .select(
      `id, title, description, slot_date, start_time, end_time, price, coaching_type,
       capacity, status,
       club_coaching_bookings(id, profile_id, status, payment_status,
                              profiles!club_coaching_bookings_profile_id_fkey(id, full_name))`,
    )
    .eq("club_id", clubId)
    .gte("slot_date", from)
    .order("slot_date")
    .order("start_time");

  if (error) throw new Error(`Failed to load coaching slots: ${error.message}`);
  return data ?? [];
}

export async function bookSlot(slotId: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("club_coaching_bookings").insert({ slot_id: slotId });
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
}

export async function setBookingState(
  bookingId: number,
  patch: { status?: string; payment_status?: string },
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_coaching_bookings")
    .update(patch)
    .eq("id", bookingId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_PERMITTED");
}

export async function createSlot(params: {
  clubId: number; title: string; description: string; slotDate: string;
  startTime: string; endTime: string; price: string; coachingType: string; capacity: number;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_coaching_slots")
    .insert({
      club_id: params.clubId, title: params.title, description: params.description,
      slot_date: params.slotDate, start_time: params.startTime, end_time: params.endTime,
      price: params.price, coaching_type: params.coachingType, capacity: params.capacity,
    })
    .select("id")
    .maybeSingle();

  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  if (!data) throw new Error("NOT_PERMITTED");
  return data;
}

/** The viewer's tier at a club, with its benefits. */
export async function findMemberTier(clubId: number, profileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("member_tier", { target_club: clubId, target_profile: profileId });

  if (error) throw new Error(`Failed to load your membership: ${error.message}`);
  return (data ?? [])[0] ?? null;
}

/** Spendable points at one club. */
export async function findPointBalance(clubId: number, profileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_loyalty_transactions")
    .select("available_delta")
    .eq("club_id", clubId)
    .eq("profile_id", profileId);

  if (error) throw new Error(`Failed to load your points: ${error.message}`);
  return (data ?? []).reduce((n, r) => n + r.available_delta, 0);
}

/** Open, close or cancel a slot. The policy decides whether they may. */
export async function setSlotStatus(slotId: number, status: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_coaching_slots")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", slotId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("NOT_PERMITTED");
}
