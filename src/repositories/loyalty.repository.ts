import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function findSettings(clubId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_loyalty_settings")
    .select("club_id, enabled, point_value, table_booking_price, milestones, anniversaries, tiers")
    .eq("club_id", clubId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load the loyalty programme: ${error.message}`);
  return data;
}

/**
 * Pay any anniversaries that have come round, then read the wallet.
 *
 * In that order, and on every read, because legacy works them out lazily too.
 * The unique source key means the first read after an anniversary writes one
 * row and every read after that writes none.
 */
export async function syncAndFindWallet(clubId: number, profileId: string) {
  const supabase = await createClient();

  const { error: syncError } = await supabase
    .rpc("sync_loyalty_anniversaries", { target_club: clubId, target_profile: profileId });
  // A failed top-up must not blank the balance they came to look at.
  if (syncError) console.warn("loyalty anniversary sync failed", syncError.message);

  const { data, error } = await supabase
    .from("club_loyalty_transactions")
    .select("id, kind, category, description, available_delta, lifetime_delta, created_at")
    .eq("club_id", clubId)
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(`Failed to load your points: ${error.message}`);
  return data ?? [];
}

/** Every wallet at a club, for the club's own leaderboard. */
export async function findClubWallets(clubId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_loyalty_transactions")
    .select("id, profile_id, kind, category, description, available_delta, lifetime_delta, created_at, profiles!inner(id, full_name)")
    .order("created_at", { ascending: false })
    .eq("club_id", clubId);

  if (error) throw new Error(`Failed to load loyalty standings: ${error.message}`);
  return data ?? [];
}
