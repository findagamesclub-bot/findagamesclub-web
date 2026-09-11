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

/** Rivals this person has named, at any club. */
export async function findRivalsFor(profileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_rivals")
    .select("rival_id")
    .eq("profile_id", profileId);

  if (error) throw new Error(`Failed to load your rivals: ${error.message}`);
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

export type MerchRow = {
  id: number; legacy_id: string; name: string;
  category: string | null; description: string | null;
  image_src: string | null; image_alt: string | null;
  price: string | null; stock: number;
  minimum_tier_key: string | null; active: boolean; position: number;
  club_merchandise_variants: {
    id: number; label: string; stock: number; active: boolean; position: number;
  }[];
};

export async function findMerchandise(clubId: number): Promise<MerchRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_merchandise_items")
    .select(`id, legacy_id, name, category, description, image_src, image_alt, price,
             stock, minimum_tier_key, active, position,
             club_merchandise_variants(id, label, stock, active, position)`)
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

/**
 * A whole bag in one order.
 *
 * Same reasoning as placeOrder above, times the number of lines: stock is
 * locked and decremented per size, and the tier discount and the points are
 * recomputed from the club's own settings rather than trusted from the form.
 */
export async function placeCartOrder(params: {
  lines: { itemId: number; variantId: number | null; quantity: number }[];
  notes: string;
  redeemPoints: number;
}) {
  const supabase = await createClient();
  // 0038 is newer than the generated types. Delete the cast once they are
  // regenerated, along with the one in placeOrder's neighbours.
  const { data, error } = await (supabase.rpc as unknown as (
    name: string, args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>)(
    "place_merchandise_cart_order",
    { lines: params.lines, note: params.notes, redeem: params.redeemPoints },
  );

  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return { id: Number(data) };
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

/**
 * Bookings the club has not been paid for.
 *
 * Not filtered by date: a session that has happened and was never paid for is
 * exactly the work this number is meant to surface. Cancelled sessions and
 * cancelled bookings are out, because nobody owes for those.
 */
export async function countCoachingToPay(clubId: number): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("club_coaching_bookings")
    .select("id, club_coaching_slots!inner(club_id, status)", { count: "exact", head: true })
    .eq("club_coaching_slots.club_id", clubId)
    .neq("club_coaching_slots.status", "cancelled")
    .eq("status", "booked")
    .eq("payment_status", "unpaid");

  if (error) throw new Error(`Failed to count coaching payments: ${error.message}`);
  return count ?? 0;
}

export async function bookSlot(slotId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_coaching_bookings")
    .insert({ slot_id: slotId })
    .select("id")
    .maybeSingle();

  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  // Zero rows means RLS filtered it out - see the trap in CLAUDE.md.
  if (!data) throw new Error("MEMBERS_ONLY");
  return { id: data.id };
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

/**
 * Places taken on each of a club's coaching slots.
 *
 * Through a function because a member cannot read another member's booking:
 * counting the rows a reader can see makes every slot look emptier than it is.
 * Returns numbers only, never a row about anybody.
 */
export async function findCoachingSeats(clubId: number) {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as {
    rpc(name: string, args: Record<string, unknown>): Promise<{
      data: { slot_id: number; taken: number }[] | null;
      error: { message: string } | null;
    }>;
  }).rpc("club_coaching_seats", { p_club: clubId });

  if (error) throw new Error(`Failed to count coaching places: ${error.message}`);
  return data ?? [];
}
