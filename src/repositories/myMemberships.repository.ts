import "server-only";

import { createClient } from "@/lib/supabase/server";

export type TierRow = {
  tier_key: string; label: string; price: string | null; price_duration: string | null;
  description: string | null; is_basic: boolean; position: number;
  benefits: unknown; billing_options: unknown;
};

export type MyMembershipRow = {
  id: number;
  status: string;
  tier_key: string | null;
  tier_assigned_at: string | null;
  joined_at: string | null;
  created_at: string;
  decline_reason: string | null;
  requested_tier_key: string | null;
  tier_requested_at: string | null;
  clubs: {
    id: number; slug: string; name: string; city: string; logo_url: string | null;
    club_membership_tiers: TierRow[];
  };
};

/**
 * `src/types/database.ts` is generated from the live schema and does not know
 * requested_tier_key until 0025 is applied and the types are regenerated. Same
 * temporary narrowing as competitions; delete this block once they exist.
 */
type Chain = {
  select(columns: string): Chain;
  eq(column: string, value: string): Chain;
  order(column: string, options: { ascending: boolean }): Promise<{
    data: MyMembershipRow[] | null;
    error: { message: string } | null;
  }>;
};

const COLUMNS = `
  id, status, tier_key, tier_assigned_at, joined_at, created_at, decline_reason,
  requested_tier_key, tier_requested_at,
  clubs!inner(id, slug, name, city, logo_url,
    club_membership_tiers(tier_key, label, price, price_duration, description,
                          is_basic, position, benefits, billing_options))`;

/**
 * Every club the viewer has applied to, in one query.
 *
 * Cancelled and declined rows come back too. "You left this club in March" is
 * part of the answer to "which clubs am I in", and hiding it makes a member who
 * cancelled think their record vanished.
 */
export async function findMine(profileId: string) {
  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as { from(name: string): Chain })
    .from("club_memberships")
    .select(COLUMNS)
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load your memberships: ${error.message}`);
  return data ?? [];
}

/**
 * Ask the club to move this membership to another tier, or clear the ask by
 * passing null.
 *
 * Goes through a security-definer function so a member cannot write tier_key
 * itself; see migration 0025.
 */
export async function requestTier(membershipId: number, tierKey: string | null) {
  const supabase = await createClient();
  const { error } = await (supabase as unknown as {
    rpc(name: string, args: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
  }).rpc("request_tier_upgrade", { membership: membershipId, wanted: tierKey });

  if (error) throw new Error(error.message);
}
