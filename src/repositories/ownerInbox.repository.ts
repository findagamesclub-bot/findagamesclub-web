import "server-only";

import type { TierRow } from "@/utils/membership-tiers";

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

/**
 * Members waiting on a tier decision, across every club this owner runs.
 *
 * Narrowed past the generated types: requested_tier_key arrived in 0025 and
 * `database.ts` does not know it until they are regenerated. The tier's label
 * comes with it, so the task can name what was asked for rather than saying
 * "a tier".
 */
export async function findTierRequestsByClub(clubIds: number[]) {
  if (!clubIds.length) return [];
  const supabase = await createClient();

  type Row = {
    id: number; club_id: number; requested_tier_key: string | null;
    tier_requested_at: string | null;
    profiles: { full_name: string | null } | null;
  };
  type Chain = {
    select(columns: string): Chain;
    in(column: string, values: number[]): Chain;
    not(column: string, op: string, value: null): Chain;
    order(column: string): Promise<{ data: Row[] | null; error: { message: string } | null }>;
  };

  const { data, error } = await (supabase as unknown as { from(name: string): Chain })
    .from("club_memberships")
    .select(`id, club_id, requested_tier_key, tier_requested_at,
             profiles!club_memberships_profile_id_fkey(full_name)`)
    .in("club_id", clubIds)
    .not("requested_tier_key", "is", null)
    .order("tier_requested_at");

  if (error) throw new Error(`Failed to load tier requests: ${error.message}`);
  return data ?? [];
}

/** tier_key to label, per club, for naming what somebody asked for. */
export async function findTierLabelsByClub(clubIds: number[]) {
  if (!clubIds.length) return new Map<string, string>();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_membership_tiers")
    .select("club_id, tier_key, label")
    .in("club_id", clubIds);

  if (error) throw new Error(`Failed to load tiers: ${error.message}`);
  return new Map((data ?? []).map((row) => [`${row.club_id}:${row.tier_key}`, row.label]));
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
export async function findUnpaidCoachingByClub(clubIds: number[], fromDate: string) {
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
    .in("club_coaching_slots.club_id", clubIds)
    // A session that has already happened is not something the owner can act
    // on from this page, and it was counting toward the badge for ever.
    .gte("club_coaching_slots.slot_date", fromDate);

  if (error) throw new Error(`Failed to load coaching bookings: ${error.message}`);
  return data ?? [];
}

/**
 * Which sections each club actually runs.
 *
 * Five counts rather than five joins: the card only needs to know whether to
 * draw a link, and an owner has a handful of clubs, not thousands.
 */
/**
 * Tables still to come at each club.
 *
 * Not a task, so it stays out of the waiting count. It is the club's own
 * measure of whether anybody is turning up, which is the thing an owner most
 * wants off a card, and the only place it was visible before was the bell.
 */
/**
 * Membership tiers for several clubs at once.
 *
 * One query rather than one per club: the owner inbox needs them only to know
 * which tiers cost nothing, and a club owner with four clubs should not pay
 * four round trips for that.
 */
export async function findTierRowsByClub(clubIds: number[]) {
  if (!clubIds.length) return new Map<number, TierRow[]>();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_membership_tiers")
    .select("club_id, tier_key, label, price, price_duration, description, is_basic, position, benefits, billing_options")
    .in("club_id", clubIds)
    .order("position");

  if (error) throw new Error(`Failed to load tiers: ${error.message}`);

  const byClub = new Map<number, TierRow[]>(clubIds.map((id) => [id, []]));
  for (const row of data ?? []) byClub.get(row.club_id)?.push(row as TierRow);
  return byClub;
}

export async function findUpcomingTablesByClub(clubIds: number[], fromDate: string) {
  if (!clubIds.length) return new Map<number, number>();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_bookings")
    .select("club_id")
    .in("club_id", clubIds)
    .eq("status", "booked")
    .gte("session_date", fromDate);

  if (error) throw new Error(`Failed to count tables: ${error.message}`);

  const counts = new Map<number, number>(clubIds.map((id) => [id, 0]));
  for (const row of data ?? []) counts.set(row.club_id, (counts.get(row.club_id) ?? 0) + 1);
  return counts;
}

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
