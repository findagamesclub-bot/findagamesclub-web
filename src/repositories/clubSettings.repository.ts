import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * The one-row-per-club settings tables.
 *
 * Update, then insert if nothing was there. Not an upsert: PostgREST writes
 * every column of the payload into `ON CONFLICT DO UPDATE`, including
 * `club_id`, and the grants in 0085 deliberately withhold update on `club_id`
 * so a settings row cannot be moved to another club. The upsert therefore asks
 * for a privilege nobody should have and fails with "permission denied for
 * table", which says nothing about the real cause.
 *
 * The same shape as the ticket cart, the poll vote and the message read
 * watermark, for the same reason. CLAUDE.md records it; I did it anyway.
 */

type SettingsTable = "club_coaching_settings" | "club_loyalty_settings";

/** Nothing to update means no row yet, which is the insert's job. */
async function upsertSettings(
  table: SettingsTable, clubId: number, patch: Record<string, unknown>,
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from(table).update(patch as never).eq("club_id", clubId)
    .select("club_id").maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return;

  const { error: failed } = await supabase
    .from(table).insert({ club_id: clubId, ...patch } as never);

  // A second tab created it first. The row is there and it is right.
  if (failed && failed.code !== "23505") throw new Error(failed.message);
}

export async function saveCoachingSettings(clubId: number, patch: {
  enabled: boolean; intro_text: string | null; policy_text: string | null;
}) {
  await upsertSettings("club_coaching_settings", clubId, patch);
}

export async function findCoachingSettings(clubId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_coaching_settings")
    .select("enabled, intro_text, policy_text")
    .eq("club_id", clubId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function saveLoyaltySettings(clubId: number, patch: {
  enabled: boolean;
  /** What one point is worth, as a number: the column is numeric, not text. */
  point_value: number | null;
  table_booking_price: string | null;
  /** What each thing earns. Legacy's four keys, kept as its own JSON shape. */
  milestones: Record<string, number>;
}) {
  await upsertSettings("club_loyalty_settings", clubId,
    { ...patch, updated_at: new Date().toISOString() });
}

export async function findLoyaltySettings(clubId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_loyalty_settings")
    .select("enabled, point_value, table_booking_price, milestones, anniversaries, tiers")
    .eq("club_id", clubId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
