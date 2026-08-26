import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { TablesInsert } from "@/types/database";

const COLUMNS =
  "id, membership_id, tier_key, tier_label, billing_option_label, price, price_duration, period_start_at, period_end_at, note, created_at";

/** Every payment recorded against one club, newest first. */
export async function findPaymentsForClub(clubId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_membership_payments")
    .select(COLUMNS)
    .eq("club_id", clubId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load payments: ${error.message}`);
  return data ?? [];
}

export async function findPaymentsForMembership(membershipId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_membership_payments")
    .select(COLUMNS)
    .eq("membership_id", membershipId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load payments: ${error.message}`);
  return data ?? [];
}

export async function insertPayment(row: TablesInsert<"club_membership_payments">) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_membership_payments")
    .insert(row)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  // The insert policy is can_manage_club, and a blocked insert throws rather
  // than returning empty — but check anyway, the same way the updates do.
  if (!data) throw new Error("NOT_PERMITTED");
  return data;
}

/** The tier a club offers, with its billing options. */
export async function findTier(clubId: number, tierKey: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("club_membership_tiers")
    .select("tier_key, label, price, price_duration, billing_options")
    .eq("club_id", clubId)
    .eq("tier_key", tierKey)
    .maybeSingle();

  if (error) throw new Error(`Failed to load tier: ${error.message}`);
  return data;
}
