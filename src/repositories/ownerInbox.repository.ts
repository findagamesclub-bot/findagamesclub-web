import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Everything waiting on a club owner, across every club they run.
 *
 * Four small queries rather than one clever join: they hit different tables
 * with different policies, and a join would make one slow query where the
 * expensive part is usually empty.
 */
export async function findOwnedClubs(profileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clubs")
    .select("id, slug, name, city")
    .eq("owner_id", profileId)
    .order("name");

  if (error) throw new Error(`Failed to load your clubs: ${error.message}`);
  return data ?? [];
}

export async function findPendingByClub(clubIds: number[]) {
  if (!clubIds.length) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_memberships")
    .select("id, club_id, profile_id, created_at, profiles!club_memberships_profile_id_fkey(id, full_name)")
    .in("club_id", clubIds)
    .eq("status", "pending")
    .order("created_at");

  if (error) throw new Error(`Failed to load join requests: ${error.message}`);
  return data ?? [];
}

export async function findOpenOrdersByClub(clubIds: number[]) {
  if (!clubIds.length) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_merchandise_orders")
    .select("id, club_id, created_at, profiles!inner(id, full_name)")
    .in("club_id", clubIds)
    .eq("status", "placed")
    .order("created_at");

  if (error) throw new Error(`Failed to load orders: ${error.message}`);
  return data ?? [];
}

/** Coaching that has been booked but not yet paid for. */
export async function findUnpaidCoachingByClub(clubIds: number[]) {
  if (!clubIds.length) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_coaching_bookings")
    .select(
      `id, booked_at,
       profiles!club_coaching_bookings_profile_id_fkey(id, full_name),
       club_coaching_slots!inner(id, club_id, title, slot_date)`,
    )
    .eq("status", "booked")
    .eq("payment_status", "unpaid")
    .in("club_coaching_slots.club_id", clubIds);

  if (error) throw new Error(`Failed to load coaching bookings: ${error.message}`);
  return data ?? [];
}

/**
 * Which sections each club actually runs.
 *
 * Five counts rather than five joins: the card only needs to know whether to
 * draw a link, and an owner has a handful of clubs, not thousands.
 */
export async function findSectionsByClub(clubIds: number[]) {
  const empty = { board: false, kit: false, coaching: false, loyalty: false, events: false };
  if (!clubIds.length) return new Map<number, typeof empty>();

  const supabase = await createClient();
  const [categories, kit, coaching, loyalty, events] = await Promise.all([
    supabase.from("club_discussion_categories").select("club_id").in("club_id", clubIds),
    supabase.from("club_merchandise_items").select("club_id").in("club_id", clubIds).eq("active", true),
    supabase.from("club_coaching_settings").select("club_id").in("club_id", clubIds).eq("enabled", true),
    supabase.from("club_loyalty_settings").select("club_id").in("club_id", clubIds).eq("enabled", true),
    supabase.from("club_events").select("club_id").in("club_id", clubIds),
  ]);

  const runs = new Map(clubIds.map((id) => [id, { ...empty }]));
  for (const row of categories.data ?? []) runs.get(row.club_id)!.board = true;
  for (const row of kit.data ?? []) runs.get(row.club_id)!.kit = true;
  for (const row of coaching.data ?? []) runs.get(row.club_id)!.coaching = true;
  for (const row of loyalty.data ?? []) runs.get(row.club_id)!.loyalty = true;
  for (const row of events.data ?? []) runs.get(row.club_id)!.events = true;
  return runs;
}
