import "server-only";

import { createClient } from "@/lib/supabase/server";

/** The viewer's cart for one event. */
export async function findCart(eventId: number, profileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_event_cart_items")
    .select("id, ticket_type_id, quantity, club_event_ticket_types(id, label, price, position)")
    .eq("event_id", eventId)
    .eq("profile_id", profileId);

  if (error) throw new Error(`Failed to load your cart: ${error.message}`);
  return data ?? [];
}

/**
 * Add or change a line.
 *
 * Update first, insert if there was nothing to update — not an upsert. Postgrest
 * writes every column of the payload into the ON CONFLICT DO UPDATE, and the
 * column grants deliberately allow updating only `quantity`: a member may change
 * how many they want, not move somebody's line onto a different event.
 */
export async function setCartLine(params: {
  eventId: number;
  ticketTypeId: number;
  quantity: number;
}) {
  const supabase = await createClient();

  const changed = await bumpCartLine(supabase, params.ticketTypeId, params.quantity);
  if (changed) return;

  const { error } = await supabase.from("club_event_cart_items").insert({
    event_id: params.eventId,
    ticket_type_id: params.ticketTypeId,
    quantity: params.quantity,
  });

  // Two adds at once: one inserted between our update and our insert. The row
  // exists now, so the update we tried first is the one that should have run.
  if (error?.code === "23505") {
    if (await bumpCartLine(supabase, params.ticketTypeId, params.quantity)) return;
  }
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
}

type Client = Awaited<ReturnType<typeof createClient>>;

/** True when a line was actually changed. RLS scopes it to the viewer's own. */
async function bumpCartLine(supabase: Client, ticketTypeId: number, quantity: number) {
  const { data, error } = await supabase
    .from("club_event_cart_items")
    .update({ quantity })
    .eq("ticket_type_id", ticketTypeId)
    .select("id")
    .maybeSingle();

  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return Boolean(data);
}

export async function removeCartLine(ticketTypeId: number, profileId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("club_event_cart_items")
    .delete()
    .eq("ticket_type_id", ticketTypeId)
    .eq("profile_id", profileId);

  if (error) throw new Error(error.message);
}

/** How many of each ticket type are already reserved. */
export async function findTicketsTaken(ticketTypeIds: number[]) {
  if (!ticketTypeIds.length) return new Map<number, number>();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("club_event_booking_items")
    .select("ticket_type_id, quantity, club_event_bookings!inner(status)")
    .in("ticket_type_id", ticketTypeIds)
    .eq("club_event_bookings.status", "reserved");

  if (error) throw new Error(`Failed to count tickets: ${error.message}`);

  const taken = new Map<number, number>();
  for (const row of data ?? []) {
    taken.set(row.ticket_type_id, (taken.get(row.ticket_type_id) ?? 0) + row.quantity);
  }
  return taken;
}

/**
 * Turn the cart into a booking.
 *
 * The definer function does the work: it prices every line from the ticket
 * type, so nothing the client sends can name its own total.
 */
export async function checkout(params: {
  eventId: number;
  fullName: string;
  email: string;
  reference: string;
  /** A request, not an instruction. 0050 checks it against the tier and the balance. */
  redeemPoints: number;
}) {
  const supabase = await createClient();
  // 0050 replaced the old signature, which took the tier discount and labels
  // from the caller. Everything about the money is read from the database now.
  // Delete the cast once the generated types are regenerated against it.
  const { data, error } = await (supabase.rpc as unknown as (
    name: string, args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>)(
    "checkout_event_cart", {
      target_event: params.eventId,
      buyer_name: params.fullName,
      buyer_email: params.email,
      booking_reference: params.reference,
      redeem: params.redeemPoints,
    });

  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return data as number;
}

